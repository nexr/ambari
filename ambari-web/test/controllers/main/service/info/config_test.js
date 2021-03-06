/**
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

var App = require('app');
require('controllers/main/service/info/configs');
var batchUtils = require('utils/batch_scheduled_requests');
var mainServiceInfoConfigsController = null;
describe("App.MainServiceInfoConfigsController", function () {

  beforeEach(function () {
    sinon.stub(App.themesMapper, 'generateAdvancedTabs').returns(Em.K);
    mainServiceInfoConfigsController = App.MainServiceInfoConfigsController.create({
      loadDependentConfigs: function () {
        return {done: Em.K}
      },
      loadConfigTheme: function () {
        return $.Deferred().resolve().promise();
      }
    });
  });

  afterEach(function() {
    App.themesMapper.generateAdvancedTabs.restore();
  });

  describe("#showSavePopup", function () {
    var tests = [
      {
        path: false,
        callback: null,
        action: "onSave",
        m: "save configs without path/callback",
        results: [
          {
            method: "restartServicePopup",
            called: true
          }
        ]
      },
      {
        path: true,
        callback: true,
        action: "onSave",
        m: "save configs with path/callback",
        results: [
          {
            method: "restartServicePopup",
            called: true
          }
        ]
      },
      {
        path: false,
        callback: false,
        action: "onDiscard",
        m: "discard changes without path/callback",
        results: [
          {
            method: "restartServicePopup",
            called: false
          }
        ]
      },
      {
        path: false,
        callback: true,
        action: "onDiscard",
        m: "discard changes with callback",
        results: [
          {
            method: "restartServicePopup",
            called: false
          },
          {
            method: "callback",
            called: true
          },
          {
            field: "hash",
            value: "hash"
          }
        ]
      },
      {
        path: true,
        callback: null,
        action: "onDiscard",
        m: "discard changes with path",
        results: [
          {
            method: "restartServicePopup",
            called: false
          },
          {
            field: "forceTransition",
            value: true
          }
        ]
      }
    ];

    beforeEach(function () {
      sinon.stub(mainServiceInfoConfigsController, "restartServicePopup", Em.K);
      sinon.stub(mainServiceInfoConfigsController, "getHash", function () {
        return "hash"
      });
      App.router.route = Em.K;
    });
    afterEach(function () {
      mainServiceInfoConfigsController.restartServicePopup.restore();
      mainServiceInfoConfigsController.getHash.restore();
    });

    tests.forEach(function (t) {
      t.results.forEach(function (r) {
        it(t.m + " " + r.method + " " + r.field, function () {
          if (t.callback) {
            t.callback = sinon.stub();
          }
          mainServiceInfoConfigsController.showSavePopup(t.path, t.callback)[t.action]();
          if (r.method) {
            if (r.method === 'callback') {
              expect(t.callback.calledOnce).to.equal(r.called);
            } else {
              expect(mainServiceInfoConfigsController[r.method].calledOnce).to.equal(r.called);
            }
          } else if (r.field) {
            expect(mainServiceInfoConfigsController.get(r.field)).to.equal(r.value);
          }
        }, this);
      });
    }, this);
  });

  describe("#hasUnsavedChanges", function () {
    beforeEach(function () {
      sinon.stub(mainServiceInfoConfigsController, "getHash", function () {
        return "hash"
      });
    });
    afterEach(function () {
      mainServiceInfoConfigsController.getHash.restore();
    });

    it("with unsaved", function () {
      mainServiceInfoConfigsController.set("hash", "hash1");
      expect(mainServiceInfoConfigsController.hasUnsavedChanges()).to.equal(true);
    });

    it("without unsaved", function () {
      mainServiceInfoConfigsController.set("hash", "hash");
      expect(mainServiceInfoConfigsController.hasUnsavedChanges()).to.equal(false);
    });
  });

  describe("#addOverrideProperty", function () {
    var serviceConfigProperty = Em.Object.create({
      overrides: [],
      isOriginalSCP: true
    });

    var group = {};
    var newSCP = App.ServiceConfigProperty.create(serviceConfigProperty);
    newSCP.set('value', '1');
    newSCP.set('isOriginalSCP', false);
    newSCP.set('parentSCP', serviceConfigProperty);
    newSCP.set('isEditable', true);
    newSCP.set('group', group);


    it("add new overridden property", function () {
      mainServiceInfoConfigsController.addOverrideProperty(serviceConfigProperty, group, '1');
      expect(serviceConfigProperty.get("overrides")[0].get('name')).to.equal(newSCP.get('name'));
      expect(serviceConfigProperty.get("overrides")[0].get('isOriginalSCP')).to.be.false;
      expect(serviceConfigProperty.get("overrides")[0].get('isEditable')).to.be.true;
      expect(serviceConfigProperty.get("overrides")[0].get('group')).to.eql({});
      expect(serviceConfigProperty.get("overrides")[0].get('parentSCP')).to.eql(serviceConfigProperty);
    });
  });

  describe("#showComponentsShouldBeRestarted", function () {

    var tests = [
      {
        input: {
          context: {
            'publicHostName1': ['TaskTracker'],
            'publicHostName2': ['JobTracker', 'TaskTracker']
          }
        },
        components: "2 TaskTrackers, 1 JobTracker",
        text: Em.I18n.t('service.service.config.restartService.shouldBeRestarted').format(Em.I18n.t('common.components'))
      },
      {
        input: {
          context: {
            'publicHostName1': ['TaskTracker']
          }
        },
        components: "1 TaskTracker",
        text: Em.I18n.t('service.service.config.restartService.shouldBeRestarted').format(Em.I18n.t('common.component'))
      }
    ];

    beforeEach(function () {
      sinon.stub(mainServiceInfoConfigsController, "showItemsShouldBeRestarted", Em.K);
    });
    afterEach(function () {
      mainServiceInfoConfigsController.showItemsShouldBeRestarted.restore();
    });

    tests.forEach(function (t) {
      it("trigger showItemsShouldBeRestarted popup with components", function () {
        mainServiceInfoConfigsController.showComponentsShouldBeRestarted(t.input);
        expect(mainServiceInfoConfigsController.showItemsShouldBeRestarted.calledWith(t.components, t.text)).to.equal(true);
      });
    });
  });

  describe("#showHostsShouldBeRestarted", function () {

    var tests = [
      {
        input: {
          context: {
            'publicHostName1': ['TaskTracker'],
            'publicHostName2': ['JobTracker', 'TaskTracker']
          }
        },
        hosts: "publicHostName1, publicHostName2",
        text: Em.I18n.t('service.service.config.restartService.shouldBeRestarted').format(Em.I18n.t('common.hosts'))
      },
      {
        input: {
          context: {
            'publicHostName1': ['TaskTracker']
          }
        },
        hosts: "publicHostName1",
        text: Em.I18n.t('service.service.config.restartService.shouldBeRestarted').format(Em.I18n.t('common.host'))
      }
    ];

    beforeEach(function () {
      sinon.stub(mainServiceInfoConfigsController, "showItemsShouldBeRestarted", Em.K);
    });
    afterEach(function () {
      mainServiceInfoConfigsController.showItemsShouldBeRestarted.restore();
    });

    tests.forEach(function (t) {
      it("trigger showItemsShouldBeRestarted popup with hosts", function () {
        mainServiceInfoConfigsController.showHostsShouldBeRestarted(t.input);
        expect(mainServiceInfoConfigsController.showItemsShouldBeRestarted.calledWith(t.hosts, t.text)).to.equal(true);
      });
    });
  });

  describe("#rollingRestartStaleConfigSlaveComponents", function () {
    var tests = [
      {
        componentName: {
          context: "ComponentName"
        },
        displayName: "displayName",
        passiveState: "ON"
      },
      {
        componentName: {
          context: "ComponentName1"
        },
        displayName: "displayName1",
        passiveState: "OFF"
      }
    ];

    beforeEach(function () {
      mainServiceInfoConfigsController.set("content", {displayName: "", passiveState: ""});
      sinon.stub(batchUtils, "launchHostComponentRollingRestart", Em.K);
    });
    afterEach(function () {
      batchUtils.launchHostComponentRollingRestart.restore();
    });
    tests.forEach(function (t) {
      it("trigger rollingRestartStaleConfigSlaveComponents", function () {
        mainServiceInfoConfigsController.set("content.displayName", t.displayName);
        mainServiceInfoConfigsController.set("content.passiveState", t.passiveState);
        mainServiceInfoConfigsController.rollingRestartStaleConfigSlaveComponents(t.componentName);
        expect(batchUtils.launchHostComponentRollingRestart.calledWith(t.componentName.context, t.displayName, t.passiveState == "ON", true)).to.equal(true);
      });
    });
  });

  describe("#restartAllStaleConfigComponents", function () {
    beforeEach(function () {
      sinon.stub(batchUtils, "restartAllServiceHostComponents", Em.K);
    });
    afterEach(function () {
      batchUtils.restartAllServiceHostComponents.restore();
    });
    it("trigger restartAllServiceHostComponents", function () {
      mainServiceInfoConfigsController.restartAllStaleConfigComponents().onPrimary();
      expect(batchUtils.restartAllServiceHostComponents.calledOnce).to.equal(true);
    });
  });

  describe("#doCancel", function () {
    beforeEach(function () {
      sinon.stub(Em.run, 'once', Em.K);
    });
    afterEach(function () {
      Em.run.once.restore();
    });
    it("trigger onConfigGroupChange", function () {
      mainServiceInfoConfigsController.doCancel();
      expect(Em.run.once.calledWith(mainServiceInfoConfigsController, "onConfigGroupChange")).to.equal(true);
    });

    it("should clear dependent configs", function() {
      mainServiceInfoConfigsController.set('groupsToSave', { HDFS: 'my cool group'});
      mainServiceInfoConfigsController.set('_dependentConfigValues', Em.A([{name: 'prop_1'}]));
      mainServiceInfoConfigsController.doCancel();
      expect(App.isEmptyObject(mainServiceInfoConfigsController.get('groupsToSave'))).to.be.true;
      expect(App.isEmptyObject(mainServiceInfoConfigsController.get('_dependentConfigValues'))).to.be.true;
    });
  });

  describe("#getMasterComponentHostValue", function () {
    var tests = [
      {
        content: {
          hostComponents: [
            Em.Object.create({
              componentName: "componentName1",
              hostName: "hostName"
            })
          ]
        },
        result: "hostName",
        multiple: false,
        m: "returns hostname"
      },
      {
        content: {
          hostComponents: [
            Em.Object.create({
              componentName: "componentName2",
              hostName: "hostName1"
            }),
            Em.Object.create({
              componentName: "componentName2",
              hostName: "hostName2"
            })
          ]
        },
        result: ["hostName1","hostName2"],
        multiple: true,
        m: "returns hostnames"
      }
    ];
    tests.forEach(function(t){
      beforeEach(function () {
        mainServiceInfoConfigsController.set("content", { hostComponents: []});
      });

      it(t.m, function () {
        mainServiceInfoConfigsController.set("content.hostComponents", t.content.hostComponents);
        expect(mainServiceInfoConfigsController.getMasterComponentHostValue(t.content.hostComponents[0].componentName, t.multiple)).to.eql(t.result);
      });
    });
  });

  describe("#putChangedConfigurations", function () {
      var sc = [
      Em.Object.create({
        configs: [
          Em.Object.create({
            name: '_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: '_newsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: '_maxnewsize',
            value: '1024m'
          })
        ]
      })
    ],
    scExc = [
      Em.Object.create({
        configs: [
          Em.Object.create({
            name: 'hadoop_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: 'yarn_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: 'nodemanager_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: 'resourcemanager_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: 'apptimelineserver_heapsize',
            value: '1024m'
          }),
          Em.Object.create({
            name: 'jobhistory_heapsize',
            value: '1024m'
          })
        ]
      })
    ];
    beforeEach(function () {
      sinon.stub(App.router, 'getClusterName', function() {
        return 'clName';
      });
      sinon.stub(App.ajax, "send", Em.K);
    });
    afterEach(function () {
      App.ajax.send.restore();
      App.router.getClusterName.restore();
    });
    it("ajax request to put cluster cfg", function () {
      mainServiceInfoConfigsController.set('stepConfigs', sc);
      expect(mainServiceInfoConfigsController.putChangedConfigurations([]));
      expect(App.ajax.send.calledOnce).to.be.true;
    });
    it('values should be parsed', function () {
      mainServiceInfoConfigsController.set('stepConfigs', sc);
      mainServiceInfoConfigsController.putChangedConfigurations([]);
      expect(mainServiceInfoConfigsController.get('stepConfigs')[0].get('configs').mapProperty('value').uniq()).to.eql(['1024m']);
    });
    it('values should not be parsed', function () {
      mainServiceInfoConfigsController.set('stepConfigs', scExc);
      mainServiceInfoConfigsController.putChangedConfigurations([]);
      expect(mainServiceInfoConfigsController.get('stepConfigs')[0].get('configs').mapProperty('value').uniq()).to.eql(['1024m']);
    });
  });

  describe("#isConfigChanged", function () {

    var tests = [
      {
        loadedConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase",
          lzo_enabled: "true"
        },
        savingConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase",
          lzo_enabled: "true"
        },
        m: "configs doesn't changed",
        res: false
      },
      {
        loadedConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase",
          lzo_enabled: "true"
        },
        savingConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase",
          lzo_enabled: "false"
        },
        m: "configs changed",
        res: true
      },
      {
        loadedConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase"
        },
        savingConfig: {
          apptimelineserver_heapsize: "1024",
          hbase_log_dir: "/var/log/hbase",
          lzo_enabled: "false"
        },
        m: "add new config",
        res: true
      }
    ];

    tests.forEach(function(t){
      it(t.m, function () {
        expect(mainServiceInfoConfigsController.isConfigChanged(t.loadedConfig, t.savingConfig)).to.equal(t.res);
      });
    });
  });

  describe("#isDirChanged", function() {

    describe("when service name is HDFS", function() {
      beforeEach(function() {
        mainServiceInfoConfigsController.set('content', Ember.Object.create ({ serviceName: 'HDFS' }));
      });

      describe("for hadoop 2", function() {

        var tests = [
          {
            it: "should set dirChanged to false if none of the properties exist",
            expect: false,
            config: Ember.Object.create ({})
          },
          {
            it: "should set dirChanged to true if dfs.namenode.name.dir is not default",
            expect: true,
            config: Ember.Object.create ({
              name: 'dfs.namenode.name.dir',
              isNotDefaultValue: true
            })
          },
          {
            it: "should set dirChanged to false if dfs.namenode.name.dir is default",
            expect: false,
            config: Ember.Object.create ({
              name: 'dfs.namenode.name.dir',
              isNotDefaultValue: false
            })
          },
          {
            it: "should set dirChanged to true if dfs.namenode.checkpoint.dir is not default",
            expect: true,
            config: Ember.Object.create ({
              name: 'dfs.namenode.checkpoint.dir',
              isNotDefaultValue: true
            })
          },
          {
            it: "should set dirChanged to false if dfs.namenode.checkpoint.dir is default",
            expect: false,
            config: Ember.Object.create ({
              name: 'dfs.namenode.checkpoint.dir',
              isNotDefaultValue: false
            })
          },
          {
            it: "should set dirChanged to true if dfs.datanode.data.dir is not default",
            expect: true,
            config: Ember.Object.create ({
              name: 'dfs.datanode.data.dir',
              isNotDefaultValue: true
            })
          },
          {
            it: "should set dirChanged to false if dfs.datanode.data.dir is default",
            expect: false,
            config: Ember.Object.create ({
              name: 'dfs.datanode.data.dir',
              isNotDefaultValue: false
            })
          }
        ];

        beforeEach(function() {
          sinon.stub(App, 'get').returns(true);
        });

        afterEach(function() {
          App.get.restore();
        });

        tests.forEach(function(test) {
          it(test.it, function() {
            mainServiceInfoConfigsController.set('stepConfigs', [Ember.Object.create ({ configs: [test.config], serviceName: 'HDFS' })]);
            expect(mainServiceInfoConfigsController.isDirChanged()).to.equal(test.expect);
          })
        });
      });
    });

  });

  describe("#addDynamicProperties", function() {

    var tests = [
      {
        stepConfigs: [Em.Object.create({
          serviceName: "HIVE",
          configs: []
        })],
        content: Em.Object.create({
          serviceName: "HIVE"
        }),
        m: "add dynamic property",
        addDynamic: true
      },
      {
        stepConfigs: [Em.Object.create({
          serviceName: "HIVE",
          configs: [
            Em.Object.create({
              name: "templeton.hive.properties"
            })
          ]
        })],
        content: Em.Object.create({
          serviceName: "HIVE"
        }),
        m: "don't add dynamic property (already included)",
        addDynamic: false
      },
      {
        stepConfigs: [Em.Object.create({
          serviceName: "HDFS",
          configs: []
        })],
        content: Em.Object.create({
          serviceName: "HDFS"
        }),
        m: "don't add dynamic property (wrong service)",
        addDynamic: false
      }
    ];
    var dynamicProperty = {
      "name": "templeton.hive.properties",
      "templateName": ["hive.metastore.uris"],
      "foreignKey": null,
      "value": "hive.metastore.local=false,hive.metastore.uris=<templateName[0]>,hive.metastore.sasl.enabled=yes,hive.metastore.execute.setugi=true,hive.metastore.warehouse.dir=/apps/hive/warehouse",
      "filename": "webhcat-site.xml"
    };



    tests.forEach(function(t) {
      it(t.m, function() {
        mainServiceInfoConfigsController.set("content", t.content);
        mainServiceInfoConfigsController.set("stepConfigs", t.stepConfigs);
        var configs = [];
        mainServiceInfoConfigsController.addDynamicProperties(configs);
        if (t.addDynamic){
          expect(configs.findProperty("name","templeton.hive.properties")).to.deep.eql(dynamicProperty);
        }
      });
    });
  });

  describe("#loadUiSideConfigs", function () {

    var t = {
      configMapping: [
        {
          foreignKey: null,
          templateName: "",
          value: "default",
          name: "name1",
          filename: "filename1"
        },
        {
          foreignKey: "notNull",
          templateName: "",
          value: "default2",
          name: "name2",
          filename: "filename2"
        }
      ],
      configMappingf: [
        {
          foreignKey: null,
          templateName: "",
          value: "default",
          name: "name1",
          filename: "filename1"
        }
      ],
      valueWithOverrides: {
        "value": "default",
        "overrides": {
          "value1": "value1",
          "value2": "value2"
        }
      },
      uiConfigs: [
        {
          "id": "site property",
          "name": "name1",
          "value": "default",
          "filename": "filename1",
          "overrides": {
            "value1": "value1",
            "value2": "value2"
          }
        }
      ]
    };

    beforeEach(function(){
      sinon.stub(mainServiceInfoConfigsController, "addDynamicProperties", Em.K);
      sinon.stub(mainServiceInfoConfigsController, "getGlobConfigValueWithOverrides", function () {
        return t.valueWithOverrides
      });
    });

    afterEach(function(){
      mainServiceInfoConfigsController.addDynamicProperties.restore();
      mainServiceInfoConfigsController.getGlobConfigValueWithOverrides.restore();
    });

    it("load ui config", function() {
      expect(mainServiceInfoConfigsController.loadUiSideConfigs(t.configMapping)[0]).to.deep.equal(t.uiConfigs[0]);
      expect(mainServiceInfoConfigsController.addDynamicProperties.calledWith(t.configMappingf)).to.equal(true);
      expect(mainServiceInfoConfigsController.getGlobConfigValueWithOverrides.calledWith(t.configMapping[0].templateName, t.configMapping[0].value, t.configMapping[0].name)).to.equal(true);
    });
  });

  describe("#formatConfigValues", function () {
    var t = {
      configs: [
        Em.Object.create({ name: "p1", value: " v1 v1 ", displayType: "" }),
        Em.Object.create({ name: "p2", value: true, displayType: "" }),
        Em.Object.create({ name: "p3", value: " d1 ", displayType: "directory" }),
        Em.Object.create({ name: "p4", value: " d1 d2 d3 ", displayType: "directories" }),
        Em.Object.create({ name: "p5", value: " v1 ", displayType: "password" }),
        Em.Object.create({ name: "p6", value: " v ", displayType: "host" }),
        Em.Object.create({ name: "javax.jdo.option.ConnectionURL", value: " v1 ", displayType: "advanced" }),
        Em.Object.create({ name: "oozie.service.JPAService.jdbc.url", value: " v1 ", displayType: "advanced" })
      ],
      result: [
        Em.Object.create({ name: "p1", value: " v1 v1", displayType: "" }),
        Em.Object.create({ name: "p2", value: "true", displayType: "" }),
        Em.Object.create({ name: "p3", value: "d1", displayType: "directory" }),
        Em.Object.create({ name: "p4", value: "d1,d2,d3", displayType: "directories" }),
        Em.Object.create({ name: "p5", value: " v1 ", displayType: "password" }),
        Em.Object.create({ name: "p6", value: "v", displayType: "host" }),
        Em.Object.create({ name: "javax.jdo.option.ConnectionURL", value: " v1", displayType: "advanced" }),
        Em.Object.create({ name: "oozie.service.JPAService.jdbc.url", value: " v1", displayType: "advanced" })
      ]
    };

    it("format config values", function () {
      mainServiceInfoConfigsController.formatConfigValues(t.configs);
      expect(t.configs).to.deep.equal(t.result);
    });

  });

  describe("#putConfigGroupChanges", function() {

    var t = {
      data: {
        ConfigGroup: {
          id: "id"
        }
      },
      request: [{
        ConfigGroup: {
          id: "id"
        }
      }]
    };

    beforeEach(function() {
      sinon.spy($,"ajax");
    });
    afterEach(function() {
      $.ajax.restore();
    });

    it("updates configs groups", function() {
      mainServiceInfoConfigsController.putConfigGroupChanges(t.data);
      expect(JSON.parse($.ajax.args[0][0].data)).to.deep.equal(t.request);
    });
  });

  describe("#setEditability", function () {

    var tests = [
      {
        isAdmin: true,
        isHostsConfigsPage: false,
        defaultGroupSelected: true,
        isReconfigurable: true,
        isEditable: true,
        m: ""
      },
      {
        isAdmin: false,
        isHostsConfigsPage: false,
        defaultGroupSelected: true,
        isReconfigurable: true,
        isEditable: false,
        m: "(non admin)"
      },
      {
        isAdmin: true,
        isHostsConfigsPage: true,
        defaultGroupSelected: true,
        isReconfigurable: true,
        isEditable: false,
        m: "(isHostsConfigsPage)"
      },
      {
        isAdmin: true,
        isHostsConfigsPage: false,
        defaultGroupSelected: false,
        isReconfigurable: true,
        isEditable: false,
        m: "(defaultGroupSelected is false)"
      },
      {
        isAdmin: true,
        isHostsConfigsPage: false,
        defaultGroupSelected: true,
        isReconfigurable: false,
        isEditable: false,
        m: "(isReconfigurable is false)"
      }
    ];

    beforeEach(function(){
      this.mock = sinon.stub(App, 'isAccessible');
    });
    afterEach(function () {
      this.mock.restore();
    });
    tests.forEach(function(t) {
      it("set isEditable " + t.isEditable + t.m, function(){
        this.mock.returns(t.isAdmin);
        mainServiceInfoConfigsController.set("isHostsConfigsPage", t.isHostsConfigsPage);
        var serviceConfigProperty = Em.Object.create({
          isReconfigurable: t.isReconfigurable
        });
        mainServiceInfoConfigsController.setEditability(serviceConfigProperty, t.defaultGroupSelected);
        expect(serviceConfigProperty.get("isEditable")).to.equal(t.isEditable);
      });
    });
  });

  describe("#checkOverrideProperty", function () {
    var tests = [{
      overrideToAdd: {
        name: "name1",
        filename: "filename1"
      },
      componentConfig: {
        configs: [
          {
            name: "name1",
            filename: "filename2"
          },
          {
            name: "name1",
            filename: "filename1"
          }
        ]
      },
      add: true,
      m: "add property"
    },
      {
        overrideToAdd: {
          name: "name1"
        },
        componentConfig: {
          configs: [
            {
              name: "name2"
            }
          ]
        },
        add: false,
        m: "don't add property, different names"
      },
      {
        overrideToAdd: {
          name: "name1",
          filename: "filename1"
        },
        componentConfig: {
          configs: [
            {
              name: "name1",
              filename: "filename2"
            }
          ]
        },
        add: false,
        m: "don't add property, different filenames"
      },
      {
        overrideToAdd: null,
        componentConfig: {},
        add: false,
        m: "don't add property, overrideToAdd is null"
      }];

    beforeEach(function() {
      sinon.stub(mainServiceInfoConfigsController,"addOverrideProperty", Em.K)
    });
    afterEach(function() {
      mainServiceInfoConfigsController.addOverrideProperty.restore();
    });
    tests.forEach(function(t) {
      it(t.m, function() {
        mainServiceInfoConfigsController.set("overrideToAdd", t.overrideToAdd);
        mainServiceInfoConfigsController.checkOverrideProperty(t.componentConfig);
        if(t.add) {
          expect(mainServiceInfoConfigsController.addOverrideProperty.calledWith(t.overrideToAdd)).to.equal(true);
          expect(mainServiceInfoConfigsController.get("overrideToAdd")).to.equal(null);
        } else {
          expect(mainServiceInfoConfigsController.addOverrideProperty.calledOnce).to.equal(false);
        }
      });
    });
  });

  describe("#trackRequest()", function () {
    after(function(){
      mainServiceInfoConfigsController.set('requestInProgress', null);
    });
    it("should set requestInProgress", function () {
      mainServiceInfoConfigsController.trackRequest({'request': {}});
      expect(mainServiceInfoConfigsController.get('requestInProgress')).to.eql({'request': {}});
    });
  });

  describe("#setValuesForOverrides", function() {
    var tests = [
      {
        overrides: [
          {name: "override1"},
          {name: "override2"}
        ],
        _serviceConfigProperty: {},
        serviceConfigProperty: Em.Object.create({overrides: Em.A([])}),
        defaultGroupSelected: true
      }
    ];
    beforeEach(function() {
      sinon.stub(mainServiceInfoConfigsController, "createNewSCP", function(override) {return {name: override.name}})
    });
    afterEach(function() {
      mainServiceInfoConfigsController.createNewSCP.restore();
    });
    tests.forEach(function(t) {
      it("set values for overrides. use createNewSCP method to do this", function() {
        var serviceConfigProperty = t.serviceConfigProperty;
        mainServiceInfoConfigsController.setValuesForOverrides(t.overrides, serviceConfigProperty, t.serviceConfigProperty, t.defaultGroupSelected);
        expect(serviceConfigProperty.get("overrides")[0]).to.eql(t.overrides[0]);
        expect(serviceConfigProperty.get("overrides")[1]).to.eql(t.overrides[1]);
      });
    });
  });

  describe("#createConfigProperty", function() {
    var tests = [
      {
        _serviceConfigProperty: {
          overrides: {

          }
        },
        defaultGroupSelected: true,
        restartData: {},
        serviceConfigsData: {},
        serviceConfigProperty: {
          overrides: null,
          isOverridable: true
        }
      }];
    beforeEach(function() {
      sinon.stub(mainServiceInfoConfigsController, "setValuesForOverrides", Em.K);
      sinon.stub(mainServiceInfoConfigsController, "setEditability", Em.K);
    });
    afterEach(function() {
      mainServiceInfoConfigsController.setValuesForOverrides.restore();
      mainServiceInfoConfigsController.setEditability.restore();
    });
    tests.forEach(function(t) {
      it("create service config. run methods to correctly set object fileds", function() {
        var result = mainServiceInfoConfigsController.createConfigProperty(t._serviceConfigProperty, t.defaultGroupSelected, t.restartData, t.serviceConfigsData);
        expect(mainServiceInfoConfigsController.setValuesForOverrides.calledWith(t._serviceConfigProperty.overrides, t._serviceConfigProperty, t.serviceConfigProperty, t.defaultGroupSelected));
        expect(result.getProperties('overrides','isOverridable')).to.eql(t.serviceConfigProperty);
      });
    });
  });

  describe("#createNewSCP", function() {
    var tests = [
      {
        overrides: {
          value: "value",
          group: {
            value: "group1"
          }
        },
        _serviceConfigProperty: {},
        serviceConfigProperty: Em.Object.create({
          value: "parentSCP",
          supportsFinal: true
        }),
        defaultGroupSelected: true,

        newSCP: {
          value: "value",
          isOriginalSCP: false,
          parentSCP:Em.Object.create({
            value: "parentSCP",
            supportsFinal: true
          }),
          group: {
            value: "group1"
          },
          isEditable: false
        }
      }
    ];
    tests.forEach(function(t) {
      it("", function() {
        var newSCP = mainServiceInfoConfigsController.createNewSCP(t.overrides, t._serviceConfigProperty, t.serviceConfigProperty, t.defaultGroupSelected);
        expect(newSCP.getProperties("value", "isOriginalSCP", "parentSCP", "group", "isEditable")).to.eql(t.newSCP);
      });
    });
  });

  describe("#setCompareDefaultGroupConfig", function() {
    beforeEach(function() {
      sinon.stub(mainServiceInfoConfigsController, "getComparisonConfig").returns("compConfig");
      sinon.stub(mainServiceInfoConfigsController, "getMockComparisonConfig").returns("mockConfig");
      sinon.stub(mainServiceInfoConfigsController, "hasCompareDiffs").returns(true);
    });
    afterEach(function() {
      mainServiceInfoConfigsController.getComparisonConfig.restore();
      mainServiceInfoConfigsController.getMockComparisonConfig.restore();
      mainServiceInfoConfigsController.hasCompareDiffs.restore();
    });
    it("expect that setCompareDefaultGroupConfig will not run anything", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({}).compareConfigs.length).to.equal(0);
    });
    it("expect that setCompareDefaultGroupConfig will not run anything", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({},{}).compareConfigs.length).to.equal(0);
    });
    it("expect that serviceConfig.compareConfigs will be getMockComparisonConfig", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({isUserProperty: true}, null)).to.eql({compareConfigs: ["mockConfig"], isUserProperty: true, isComparison: true, hasCompareDiffs: true});
    });
    it("expect that serviceConfig.compareConfigs will be getComparisonConfig", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({isUserProperty: true}, {})).to.eql({compareConfigs: ["compConfig"], isUserProperty: true, isComparison: true, hasCompareDiffs: true});
    });
    it("expect that serviceConfig.compareConfigs will be getComparisonConfig", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({isReconfigurable: true}, {})).to.eql({compareConfigs: ["compConfig"], isReconfigurable: true, isComparison: true, hasCompareDiffs: true});
    });
    it("expect that serviceConfig.compareConfigs will be getComparisonConfig", function() {
      expect(mainServiceInfoConfigsController.setCompareDefaultGroupConfig({isReconfigurable: true, isMock: true}, {})).to.eql({compareConfigs: ["compConfig"], isReconfigurable: true, isMock: true, isComparison: true, hasCompareDiffs: true});
    });

  });

  describe('#showSaveConfigsPopup', function () {

    var bodyView;

    describe('#bodyClass', function () {
      beforeEach(function() {
        sinon.stub(App.ajax, 'send', Em.K);
        // default implementation
        bodyView = mainServiceInfoConfigsController.showSaveConfigsPopup().get('bodyClass').create({
          parentView: Em.View.create()
        });
      });

      afterEach(function() {
        App.ajax.send.restore();
      });

      describe('#componentsFilterSuccessCallback', function () {
        it('check components with unknown state', function () {
          bodyView = mainServiceInfoConfigsController.showSaveConfigsPopup('', true, '', {}, '', 'unknown', '').get('bodyClass').create({
            parentView: Em.View.create()
          });
          bodyView.componentsFilterSuccessCallback({
            items: [
              {
                ServiceComponentInfo: {
                  total_count: 4,
                  started_count: 2,
                  installed_count: 1,
                  component_name: 'c1'
                },
                host_components: [
                  {HostRoles: {host_name: 'h1'}}
                ]
              }
            ]
          });
          var unknownHosts = bodyView.get('unknownHosts');
          expect(unknownHosts.length).to.equal(1);
          expect(unknownHosts[0]).to.eql({name: 'h1', components: 'C1'});
        });
      });
    });
  });

  describe('#setHiveHostName', function () {

    Em.A([
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'New MySQL Database'}),
            Em.Object.create({name: 'hive_database_type', value: 'mysql'}),
            Em.Object.create({name: 'hive_ambari_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: New MySQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'New PostgreSQL Database'}),
            Em.Object.create({name: 'hive_database_type', value: 'mysql'}),
            Em.Object.create({name: 'hive_ambari_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: New PostgreSQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'Existing MySQL Database'}),
            Em.Object.create({name: 'hive_database_type', value: 'mysql'}),
            Em.Object.create({name: 'hive_existing_mysql_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_ambari_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: Existing MySQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'Existing PostgreSQL Database'}),
            Em.Object.create({name: 'hive_database_type', value: 'postgresql'}),
            Em.Object.create({name: 'hive_existing_postgresql_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_ambari_database', 'hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: Existing PostgreSQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'Existing Oracle Database'}),
            Em.Object.create({name: 'hive_database_type', value: 'oracle'}),
            Em.Object.create({name: 'hive_existing_oracle_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_ambari_database', 'hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: Existing Oracle Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'Existing MSSQL Server database with SQL authentication'}),
            Em.Object.create({name: 'hive_database_type', value: 'mssql'}),
            Em.Object.create({name: 'hive_existing_mssql_server_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_ambari_database', 'hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_mssql_server_2_database', 'hive_existing_mssql_server_2_host'],
          m: 'hive_database: Existing MSSQL Server database with SQL authentication',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'hive_database', value: 'Existing MSSQL Server database with integrated authentication'}),
            Em.Object.create({name: 'hive_database_type', value: 'mssql'}),
            Em.Object.create({name: 'hive_existing_mssql_server_2_host', value: 'h1'}),
            Em.Object.create({name: 'hive_hostname', value: 'h2'})
          ],
          removed: ['hive_ambari_database', 'hive_existing_mysql_host', 'hive_existing_mysql_database', 'hive_existing_postgresql_host', 'hive_existing_postgresql_database', 'hive_existing_oracle_host', 'hive_existing_oracle_database', 'hive_existing_mssql_server_database', 'hive_existing_mssql_server_host'],
          m: 'hive_database: Existing MSSQL Server database with integrated authentication',
          host: 'h2'
        }
      ]).forEach(function (test) {
        it(test.m, function () {
          var configs = test.globals.slice();
          test.removed.forEach(function (c) {
            configs.pushObject(Em.Object.create({name: c}))
          });
          configs = mainServiceInfoConfigsController.setHiveHostName(configs);
          test.removed.forEach(function (name) {
            if (!Em.isNone(configs.findProperty('name', name))) console.log('!!!!', name);
            expect(Em.isNone(configs.findProperty('name', name))).to.equal(true);
          });
          expect(configs.findProperty('name', 'hive_hostname').value).to.equal(test.host);
        });
      });

  });

  describe('#setOozieHostName', function () {

    Em.A([
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'New Derby Database'}),
            Em.Object.create({name: 'oozie_ambari_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_existing_postgresql_host', 'oozie_existing_postgresql_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: New Derby Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'New MySQL Database'}),
            Em.Object.create({name: 'oozie_ambari_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_derby_database', 'oozie_existing_postgresql_host', 'oozie_existing_postgresql_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: New MySQL Database',
          host: 'h1'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'Existing MySQL Database'}),
            Em.Object.create({name: 'oozie_existing_mysql_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_derby_database', 'oozie_existing_postgresql_host', 'oozie_existing_postgresql_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: Existing MySQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'Existing PostgreSQL Database'}),
            Em.Object.create({name: 'oozie_existing_postgresql_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: Existing PostgreSQL Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'Existing Oracle Database'}),
            Em.Object.create({name: 'oozie_existing_oracle_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_derby_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: Existing Oracle Database',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'Existing MSSQL Server database with SQL authentication'}),
            Em.Object.create({name: 'oozie_existing_oracle_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_derby_database', 'oozie_existing_postgresql_host', 'oozie_existing_postgresql_database', 'oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_existing_mssql_server_2_database', 'oozie_existing_mssql_server_2_host'],
          m: 'oozie_database: Existing MSSQL Server database with SQL authentication',
          host: 'h2'
        },
        {
          globals: [
            Em.Object.create({name: 'oozie_database', value: 'Existing MSSQL Server database with integrated authentication'}),
            Em.Object.create({name: 'oozie_existing_oracle_host', value: 'h1'}),
            Em.Object.create({name: 'oozie_hostname', value: 'h2'})
          ],
          removed: ['oozie_ambari_database', 'oozie_existing_oracle_host', 'oozie_existing_oracle_database', 'oozie_derby_database', 'oozie_existing_postgresql_host', 'oozie_existing_postgresql_database', 'oozie_existing_mysql_host', 'oozie_existing_mysql_database', 'oozie_existing_mssql_server_database', 'oozie_existing_mssql_server_host'],
          m: 'oozie_database: Existing MSSQL Server database with integrated authentication',
          host: 'h2'
        }
      ]).forEach(function (test) {
        it(test.m, function () {
          var configs = test.globals.slice();
          test.removed.forEach(function (c) {
            if (!configs.findProperty('name', c)) {
              configs.pushObject(Em.Object.create({name: c}))
            }
          });
          configs = mainServiceInfoConfigsController.setOozieHostName(configs);
          test.removed.forEach(function (name) {
            expect(Em.isNone(configs.findProperty('name', name))).to.equal(true);
          });
          expect(configs.findProperty('name', 'oozie_hostname').value).to.equal(test.host);
        });
      });

  });

  describe('#errorsCount', function () {

    it('should ignore configs with widgets (enhanced configs)', function () {

      mainServiceInfoConfigsController.reopen({selectedService: {
        configs: [
          Em.Object.create({isVisible: true, widget: Em.View, isValid: false}),
          Em.Object.create({isVisible: true, widget: Em.View, isValid: true}),
          Em.Object.create({isVisible: true, isValid: true}),
          Em.Object.create({isVisible: true, isValid: false})
        ]
      }});

      expect(mainServiceInfoConfigsController.get('errorsCount')).to.equal(1);

    });

    it('should ignore configs with widgets (enhanced configs) and hidden configs', function () {

      mainServiceInfoConfigsController.reopen({selectedService: {
        configs: [
          Em.Object.create({isVisible: true, widget: Em.View, isValid: false}),
          Em.Object.create({isVisible: true, widget: Em.View, isValid: true}),
          Em.Object.create({isVisible: false, isValid: false}),
          Em.Object.create({isVisible: true, isValid: true}),
          Em.Object.create({isVisible: true, isValid: false})
        ]
      }});

      expect(mainServiceInfoConfigsController.get('errorsCount')).to.equal(1);

    });

  });

  describe('#mergeWithStackProperties', function () {

    it('should set recommended value', function () {
      mainServiceInfoConfigsController.reopen({
        advancedConfigs: [
          Em.Object.create({
            name: 'n1',
            value: 'v1'
          })
        ]
      });
      var configs = [
        Em.Object.create({
          name: 'n1',
          recommendedValue: null
        })
      ];
      configs = mainServiceInfoConfigsController.mergeWithStackProperties(configs);
      expect(configs.findProperty('name', 'n1').get('recommendedValue')).to.equal('v1');
    });

  });

});
