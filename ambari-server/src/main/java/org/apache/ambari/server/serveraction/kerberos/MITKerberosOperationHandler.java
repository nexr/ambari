/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.ambari.server.serveraction.kerberos;

import org.apache.ambari.server.utils.ShellCommandUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.text.NumberFormat;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MITKerberosOperationHandler is an implementation of a KerberosOperationHandler providing
 * functionality specifically for an MIT KDC. See http://web.mit.edu/kerberos.
 * <p/>
 * It is assumed that a MIT Kerberos client is installed and that the kdamin shell command is
 * available
 */
public class MITKerberosOperationHandler extends KerberosOperationHandler {

  /**
   * A regular expression pattern to use to parse the key number from the text captured from the
   * get_principal kadmin command
   */
  private final static Pattern PATTERN_GET_KEY_NUMBER = Pattern.compile("^.*?Key: vno (\\d+).*$", Pattern.DOTALL);

  private final static Logger LOG = LoggerFactory.getLogger(MITKerberosOperationHandler.class);

  private String adminServerHost = null;

  /**
   * A String containing the resolved path to the kdamin executable
   */
  private String executableKadmin = null;

  /**
   * A String containing the resolved path to the kdamin.local executable
   */
  private String executableKadminLocal = null;

  /**
   * Prepares and creates resources to be used by this KerberosOperationHandler
   * <p/>
   * It is expected that this KerberosOperationHandler will not be used before this call.
   * <p/>
   * The kerberosConfiguration Map is not being used.
   *
   * @param administratorCredentials a KerberosCredential containing the administrative credentials
   *                                 for the relevant KDC
   * @param realm                    a String declaring the default Kerberos realm (or domain)
   * @param kerberosConfiguration    a Map of key/value pairs containing data from the kerberos-env configuration set
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  @Override
  public void open(KerberosCredential administratorCredentials, String realm,
                   Map<String, String> kerberosConfiguration)
      throws KerberosOperationException {

    setAdministratorCredentials(administratorCredentials);
    setDefaultRealm(realm);

    if (kerberosConfiguration != null) {
      setKeyEncryptionTypes(translateEncryptionTypes(kerberosConfiguration.get(KERBEROS_ENV_ENCRYPTION_TYPES), "\\s+"));
      setAdminServerHost(kerberosConfiguration.get(KERBEROS_ENV_ADMIN_SERVER_HOST));
      setExecutableSearchPaths(kerberosConfiguration.get(KERBEROS_ENV_EXECUTABLE_SEARCH_PATHS));
    }

    // Pre-determine the paths to relevant Kerberos executables
    executableKadmin = getExecutable("kadmin");
    executableKadminLocal = getExecutable("kadmin.local");

    setOpen(true);
  }

  @Override
  public void close() throws KerberosOperationException {
    // There is nothing to do here.
    setOpen(false);

    executableKadmin = null;
    executableKadminLocal = null;
  }

  /**
   * Test to see if the specified principal exists in a previously configured MIT KDC
   * <p/>
   * This implementation creates a query to send to the kadmin shell command and then interrogates
   * the result from STDOUT to determine if the presence of the specified principal.
   *
   * @param principal a String containing the principal to test
   * @return true if the principal exists; false otherwise
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  @Override
  public boolean principalExists(String principal)
      throws KerberosOperationException {

    if (!isOpen()) {
      throw new KerberosOperationException("This operation handler has not been opened");
    }

    if (principal == null) {
      return false;
    } else {
      // Create the KAdmin query to execute:
      ShellCommandUtil.Result result = invokeKAdmin(String.format("get_principal %s", principal));

      // If there is data from STDOUT, see if the following string exists:
      //    Principal: <principal>
      String stdOut = result.getStdout();
      return (stdOut != null) && stdOut.contains(String.format("Principal: %s", principal));
    }
  }


  /**
   * Creates a new principal in a previously configured MIT KDC
   * <p/>
   * This implementation creates a query to send to the kadmin shell command and then interrogates
   * the result from STDOUT to determine if the operation executed successfully.
   *
   * @param principal a String containing the principal add
   * @param password  a String containing the password to use when creating the principal
   * @param service   a boolean value indicating whether the principal is to be created as a service principal or not
   * @return an Integer declaring the generated key number
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  @Override
  public Integer createPrincipal(String principal, String password, boolean service)
      throws KerberosOperationException {

    if (!isOpen()) {
      throw new KerberosOperationException("This operation handler has not been opened");
    }

    if ((principal == null) || principal.isEmpty()) {
      throw new KerberosOperationException("Failed to create new principal - no principal specified");
    } else if ((password == null) || password.isEmpty()) {
      throw new KerberosOperationException("Failed to create new principal - no password specified");
    } else {
      // Create the kdamin query:  add_principal <-randkey|-pw <password>> <principal>
      ShellCommandUtil.Result result = invokeKAdmin(String.format("add_principal -pw %s %s", password, principal));

      // If there is data from STDOUT, see if the following string exists:
      //    Principal "<principal>" created
      String stdOut = result.getStdout();
      if ((stdOut != null) && stdOut.contains(String.format("Principal \"%s\" created", principal))) {
        return getKeyNumber(principal);
      } else {
        throw new KerberosOperationException(String.format("Failed to create service principal for %s\nSTDOUT: %s\nSTDERR: %s",
            principal, stdOut, result.getStderr()));
      }
    }
  }

  /**
   * Updates the password for an existing principal in a previously configured MIT KDC
   * <p/>
   * This implementation creates a query to send to the kadmin shell command and then interrogates
   * the exit code to determine if the operation executed successfully.
   *
   * @param principal a String containing the principal to update
   * @param password  a String containing the password to set
   * @return an Integer declaring the new key number
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  @Override
  public Integer setPrincipalPassword(String principal, String password) throws KerberosOperationException {
    if (!isOpen()) {
      throw new KerberosOperationException("This operation handler has not been opened");
    }

    if ((principal == null) || principal.isEmpty()) {
      throw new KerberosOperationException("Failed to set password - no principal specified");
    } else if ((password == null) || password.isEmpty()) {
      throw new KerberosOperationException("Failed to set password - no password specified");
    } else {
      // Create the kdamin query:  change_password <-randkey|-pw <password>> <principal>
      invokeKAdmin(String.format("change_password -pw %s %s", password, principal));

      return getKeyNumber(principal);
    }
  }

  /**
   * Removes an existing principal in a previously configured KDC
   * <p/>
   * The implementation is specific to a particular type of KDC.
   *
   * @param principal a String containing the principal to remove
   * @return true if the principal was successfully removed; otherwise false
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  @Override
  public boolean removePrincipal(String principal) throws KerberosOperationException {
    if (!isOpen()) {
      throw new KerberosOperationException("This operation handler has not been opened");
    }

    if ((principal == null) || principal.isEmpty()) {
      throw new KerberosOperationException("Failed to remove new principal - no principal specified");
    } else {
      ShellCommandUtil.Result result = invokeKAdmin(String.format("delete_principal -force %s", principal));

      // If there is data from STDOUT, see if the following string exists:
      //    Principal "<principal>" created
      String stdOut = result.getStdout();
      return (stdOut != null) && !stdOut.contains("Principal does not exist");
    }
  }

  /**
   * Retrieves the current key number assigned to the identity identified by the specified principal
   *
   * @param principal a String declaring the principal to look up
   * @return an Integer declaring the current key number
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  private Integer getKeyNumber(String principal) throws KerberosOperationException {
    if (!isOpen()) {
      throw new KerberosOperationException("This operation handler has not been opened");
    }

    if ((principal == null) || principal.isEmpty()) {
      throw new KerberosOperationException("Failed to get key number for principal  - no principal specified");
    } else {
      // Create the kdamin query:  get_principal <principal>
      ShellCommandUtil.Result result = invokeKAdmin(String.format("get_principal %s", principal));

      String stdOut = result.getStdout();
      if (stdOut == null) {
        String message = String.format("Failed to get key number for %s:\n\tExitCode: %s\n\tSTDOUT: NULL\n\tSTDERR: %s",
            principal, result.getExitCode(), result.getStderr());
        LOG.warn(message);
        throw new KerberosOperationException(message);
      }

      Matcher matcher = PATTERN_GET_KEY_NUMBER.matcher(stdOut);
      if (matcher.matches()) {
        NumberFormat numberFormat = NumberFormat.getIntegerInstance();
        String keyNumber = matcher.group(1);

        numberFormat.setGroupingUsed(false);
        try {
          Number number = numberFormat.parse(keyNumber);
          return (number == null) ? 0 : number.intValue();
        } catch (ParseException e) {
          String message = String.format("Failed to get key number for %s - invalid key number value (%s):\n\tExitCode: %s\n\tSTDOUT: NULL\n\tSTDERR: %s",
              principal, keyNumber, result.getExitCode(), result.getStderr());
          LOG.warn(message);
          throw new KerberosOperationException(message);
        }
      } else {
        String message = String.format("Failed to get key number for %s - unexpected STDOUT data:\n\tExitCode: %s\n\tSTDOUT: NULL\n\tSTDERR: %s",
            principal, result.getExitCode(), result.getStderr());
        LOG.warn(message);
        throw new KerberosOperationException(message);
      }
    }
  }

  /**
   * Invokes the kadmin shell command to issue queries
   *
   * @param query a String containing the query to send to the kdamin command
   * @return a ShellCommandUtil.Result containing the result of the operation
   * @throws KerberosKDCConnectionException       if a connection to the KDC cannot be made
   * @throws KerberosAdminAuthenticationException if the administrator credentials fail to authenticate
   * @throws KerberosRealmException               if the realm does not map to a KDC
   * @throws KerberosOperationException           if an unexpected error occurred
   */
  private ShellCommandUtil.Result invokeKAdmin(String query)
      throws KerberosOperationException {
    ShellCommandUtil.Result result = null;

    if ((query == null) || query.isEmpty()) {
      throw new KerberosOperationException("Missing kadmin query");
    }
    KerberosCredential administratorCredentials = getAdministratorCredentials();
    String defaultRealm = getDefaultRealm();

    List<String> command = new ArrayList<String>();
    File tempKeytabFile = null;

    try {
      String adminPrincipal = (administratorCredentials == null)
          ? null
          : administratorCredentials.getPrincipal();

      if ((adminPrincipal == null) || adminPrincipal.isEmpty()) {
        // Set the kdamin interface to be kadmin.local
        if((executableKadminLocal == null) || executableKadminLocal.isEmpty()) {
          throw new KerberosOperationException("No path for kadmin.local is available - this KerberosOperationHandler may not have been opened.");
        }

        command.add(executableKadminLocal);
      } else {
        if((executableKadmin == null) || executableKadmin.isEmpty()) {
          throw new KerberosOperationException("No path for kadmin is available - this KerberosOperationHandler may not have been opened.");
        }
        String adminPassword = administratorCredentials.getPassword();
        String adminKeyTab = administratorCredentials.getKeytab();

        // Set the kdamin interface to be kadmin
        command.add(executableKadmin);

        // Add explicit KDC admin host, if available
        if (getAdminServerHost() != null) {
          command.add("-s");
          command.add(getAdminServerHost());
        }

        // Add the administrative principal
        command.add("-p");
        command.add(adminPrincipal);

        if ((adminKeyTab != null) && !adminKeyTab.isEmpty()) {
          tempKeytabFile = createKeytabFile(adminKeyTab);

          if (tempKeytabFile != null) {
            // Add keytab file administrative principal
            command.add("-k");
            command.add("-t");
            command.add(tempKeytabFile.getAbsolutePath());
          }
        } else if (adminPassword != null) {
          // Add password for administrative principal
          command.add("-w");
          command.add(adminPassword);
        }
      }

      if ((defaultRealm != null) && !defaultRealm.isEmpty()) {
        // Add default realm clause
        command.add("-r");
        command.add(defaultRealm);
      }

      // Add kadmin query
      command.add("-q");
      command.add(query.replace("\"", "\\\""));

      result = executeCommand(command.toArray(new String[command.size()]));

      if (!result.isSuccessful()) {
        // Build command string, replacing administrator password with "********"
        StringBuilder cleanCommand = new StringBuilder();
        Iterator<String> iterator = command.iterator();

        if (iterator.hasNext()) {
          cleanCommand.append(iterator.next());
        }

        while (iterator.hasNext()) {
          String part = iterator.next();

          cleanCommand.append(' ');

          if (part.contains(" ")) {
            cleanCommand.append('"');
            cleanCommand.append(part);
            cleanCommand.append('"');
          } else {
            cleanCommand.append(part);
          }

          if ("-w".equals(part)) {
            // Skip the password and use "********" instead
            if (iterator.hasNext()) {
              iterator.next();
            }
            cleanCommand.append(" ********");
          }
        }
        String message = String.format("Failed to execute kadmin:\n\tCommand: %s\n\tExitCode: %s\n\tSTDOUT: %s\n\tSTDERR: %s",
            cleanCommand.toString(), result.getExitCode(), result.getStdout(), result.getStderr());
        LOG.warn(message);

        // Test STDERR to see of any "expected" error conditions were encountered...
        String stdErr = result.getStderr();
        // Did admin credentials fail?
        if (stdErr.contains("Client not found in Kerberos database")) {
          throw new KerberosAdminAuthenticationException(stdErr);
        } else if (stdErr.contains("Incorrect password while initializing")) {
          throw new KerberosAdminAuthenticationException(stdErr);
        }
        // Did we fail to connect to the KDC?
        else if (stdErr.contains("Cannot contact any KDC")) {
          throw new KerberosKDCConnectionException(stdErr);
        } else if (stdErr.contains("Cannot resolve network address for admin server in requested realm while initializing kadmin interface")) {
          throw new KerberosKDCConnectionException(stdErr);
        }
        // Was the realm invalid?
        else if (stdErr.contains("Missing parameters in krb5.conf required for kadmin client")) {
          throw new KerberosRealmException(stdErr);
        } else if (stdErr.contains("Cannot find KDC for requested realm while initializing kadmin interface")) {
          throw new KerberosRealmException(stdErr);
        } else {
          throw new KerberosOperationException("Unexpected error condition executing the kadmin command");
        }
      }
    } finally {
      // If a temporary keytab file was created, clean it up.
      if (tempKeytabFile != null) {
        if (!tempKeytabFile.delete()) {
          tempKeytabFile.deleteOnExit();
        }
      }
    }

    return result;
  }

  /**
   * Sets the KDC administrator server host address
   *
   * @param adminServerHost the ip address or FQDN of the KDC administrator server
   */
  public void setAdminServerHost(String adminServerHost) {
    this.adminServerHost = adminServerHost;
  }

  /**
   * Gets the IP address or FQDN of the KDC administrator server
   *
   * @return the IP address or FQDN of the KDC administrator server
   */
  public String getAdminServerHost() {
    return adminServerHost;
  }
}
