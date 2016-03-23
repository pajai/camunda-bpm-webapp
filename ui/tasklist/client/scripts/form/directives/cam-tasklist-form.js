'use strict';
var fs = require('fs');

var template = fs.readFileSync(__dirname + '/cam-tasklist-form.html', 'utf8');

var angular = require('camunda-commons-ui/vendor/angular');

  var EMBEDDED_KEY = 'embedded:',
      APP_KEY = 'app:',
      ENGINE_KEY = 'engine:',
      DEPLOYMENT_KEY = 'deployment:';

  function compact(arr) {
    var a = [];
    for (var ay in arr) {
      if (arr[ay]) {
        a.push(arr[ay]);
      }
    }
    return a;
  }

  var noop = function () {};

  module.exports = [function(){

    return {

      restrict: 'A',

      scope: {
        tasklistForm : '=',

        /*
         * current options are:
         * - hideCompleteButton: to hide the complete button inside the form directive
         * - disableCompleteButton: to disable or enable the complete button inside
         *   the form directive
         * - disableForm: to disable or enable the form
         * - disableAddVariableButton: to disable or enable the 'Add Variable' button
         *   inside a generic form
         */
        options: '=',

        /*
         * contains parameter like taskId, processDefinitionId, processDefinitionKey etc.
         */
        params: '=',

        /* will be used to make a callback when the form will be completed */
        onFormCompletionCallback: '&',

        /*
         * will be used to register a completion handler, when the completion
         * will be trigger from the outside of a form
         */
        onFormCompletion: '&',

        /*
         * is a callback which will called when the validation state of the
         * form changes (pass the flag '$invalid').
         */
        onFormValidation: '&'
      },

      template: template,

      controller: [
        '$scope',
        'Uri',
        'camAPI',
      function(
        $scope,
        Uri,
        camAPI
      ) {

        var processDefinitionResource = camAPI.resource('process-definition');
        var caseDefinitionResource = camAPI.resource('case-definition');
        var deploymentResource = camAPI.resource('deployment');

        // setup //////////////////////////////////////////////////////////////////

        $scope.onFormCompletionCallback = $scope.onFormCompletionCallback() || noop;
        $scope.onFormCompletion = $scope.onFormCompletion() || noop;
        $scope.onFormValidation = $scope.onFormValidation() || noop;
        $scope.completionHandler = noop;
        $scope.saveHandler = noop;

        $scope.$loaded = false;

        // handle tasklist form ///////////////////////////////////////////////////

        $scope.$watch('tasklistForm', function(value) {
          $scope.$loaded = false;
          if (value) {
            parseForm(value);
          }
        });

        $scope.asynchronousFormKey = {
          loaded: false
        };

        function parseForm(form) {
          var key = form.key,
              applicationContextPath = form.contextPath;

          // structure may be [embedded:][app:]formKey
          // structure may be [embedded:][deployment:]formKey

          if (!key) {
            form.type = 'generic';
            return;
          }

          if (key.indexOf(EMBEDDED_KEY) === 0) {
            key = key.substring(EMBEDDED_KEY.length);
            form.type = 'embedded';
          } else {
            form.type = 'external';
          }

          if (key.indexOf(DEPLOYMENT_KEY) === 0) {
            var resourceName = key.substring(DEPLOYMENT_KEY.length);
            // process definition -> Also care about case definition
            processDefinitionResource.get($scope.params.processDefinitionId, function(err, deploymentData) {
              // get deployment resources -> Find the one with the name
              deploymentResource.getResources(deploymentData.deploymentId, function(err, resourcesData) {
                for (var index = 0; index < resourcesData.length; ++index) {
                  if (resourcesData[index].name==resourceName) {
                    // load byte array from there
                    form.key = Uri.appUri('engine://engine/:engine/deployment/' + deploymentData.deploymentId + '/resources/' + resourcesData[index].id + '/data'); //data.deploymentId;                    
                    console.log(form.key);
                    $scope.asynchronousFormKey.key = form.key;
                    $scope.asynchronousFormKey.loaded = true;
                    //$scope.$apply();     
                  }
                }                
              });

            });
          }

          if (key.indexOf(APP_KEY) === 0) {
            if (applicationContextPath) {
              key = compact([applicationContextPath, key.substring(APP_KEY.length)])
                .join('/')
                // prevents multiple "/" in the URI
                .replace(/\/([\/]+)/, '/');

              $scope.asynchronousFormKey.key = key;
              $scope.asynchronousFormKey.loaded = true;
              //$scope.$apply();
            }
          }

          if(key.indexOf(ENGINE_KEY) === 0) {
            // resolve relative prefix
            key = Uri.appUri(key);
          }

          form.key = key;
          // special handling to allow asynchronous resolving of forms          
        }

        // completion /////////////////////////////////////////////

        var completionCallback = function (err, result)  {
          $scope.onFormCompletionCallback(err, result);
        };

        var complete = $scope.complete = function () {
          $scope.completionHandler(completionCallback);
        };

        $scope.onFormCompletion(complete);

        $scope.showCompleteButton = function () {
          return $scope.options &&
                 !$scope.options.hideCompleteButton &&
                 $scope.$loaded;
        };

        $scope.disableCompleteButton = function () {
          return $scope.$invalid || ($scope.options && $scope.options.disableCompleteButton);
        };

        // save ///////////////////////////////////////////////////

        var save = $scope.save = function (evt) {
          $scope.saveHandler(evt);
        };

        // API ////////////////////////////////////////////////////

        this.notifyFormInitialized = function () {
          $scope.$loaded = true;
        };

        this.notifyFormInitializationFailed = function (error) {
          $scope.tasklistForm.$error = error;
          // mark the form as initialized
          this.notifyFormInitialized();
          // set the '$invalid' flag to true to
          // not be able to complete a task (or start
          // a process)
          this.notifyFormValidated(true);
        };

        this.notifyFormCompleted = function (err) {
          $scope.onFormCompletion(err);
        };

        this.notifyFormValidated = function (invalid) {
          $scope.$invalid = invalid;
          $scope.onFormValidation(invalid);
        };

        this.notifyFormDirty = function (dirty) {
          $scope.$dirty = dirty;
        };


        this.getOptions = function () {
          return $scope.options || {};
        };

        this.getTasklistForm = function () {
          return $scope.tasklistForm;
        };

        this.getParams = function () {
          return $scope.params || {};
        };

        this.registerCompletionHandler = function(fn) {
          $scope.completionHandler = fn ||  noop;
        };

        this.registerSaveHandler = function(fn) {
          $scope.saveHandler = fn ||  noop;
        };


      }]
    };
  }];
