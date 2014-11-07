#!/usr/bin/env python

'''
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

import logging

logger = logging.getLogger()

class AlertCollector():
  '''
  cluster -> name -> alert dict
  '''
  def __init__(self):
    self.__buckets = {}


  def put(self, cluster, alert):
    if not cluster in self.__buckets:
      self.__buckets[cluster] = {}

    self.__buckets[cluster][alert['name']] = alert


  def remove(self, cluster, alert_name):
    '''
    Removes the alert with the specified name if it exists in the dictionary
    '''
    if not cluster in self.__buckets:
      return

    del self.__buckets[cluster][alert_name]


  def remove_by_uuid(self, alert_uuid):
    '''
    Removes the alert with the specified uuid if it exists in the dictionary
    '''
    for cluster,alert_map in self.__buckets.iteritems():
      for alert_name in alert_map.keys():
        alert = alert_map[alert_name]
        if alert['uuid'] == alert_uuid:
          self.remove(cluster, alert_name)


  def alerts(self):
    alerts = []
    for clustermap in self.__buckets.values()[:]:
      alerts.extend(clustermap.values())

    return alerts