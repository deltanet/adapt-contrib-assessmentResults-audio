define([
    'core/js/adapt',
    'core/js/views/componentView'
], function(Adapt, ComponentView) {

    var AssessmentResultsAudio = ComponentView.extend({

        events: {
            'inview': 'onInview',
            'click .results-retry-button button': 'onRetry',
            'click .audio-toggle': 'toggleAudio'
        },

        preRender: function () {
            if (this.model.setLocking) this.model.setLocking("_isVisible", false);

            this.audioIsEnabled = false;

            if(Adapt.course.get('_audio') && Adapt.course.get('_audio')._isEnabled && this.model.has('_audioAssessment') && this.model.get('_audioAssessment')._isEnabled) {
              this.setupAudio();
              this.audioIsEnabled = true;
            }

            this.saveOriginalTexts();
            this.setupEventListeners();

            this.setupModelResetEvent();

            this.checkIfComplete();

            this.checkIfVisible();
        },

        saveOriginalTexts: function() {
            this.model.set({
                "originalTitle": this.model.get("title"),
                "originalBody": this.model.get("body"),
                "originalInstruction": this.model.get("instruction")
            });
        },

        setupAudio: function() {
          // Set vars
          this.audioChannel = this.model.get("_audioAssessment")._channel;
          this.elementId = this.model.get("_id");
          this.audioFile = this.model.get("_audioAssessment")._media.src;

          // Autoplay
          if(Adapt.audio.autoPlayGlobal || this.model.get("_audioAssessment")._autoplay){
              this.canAutoplay = true;
          } else {
              this.canAutoplay = false;
          }

          // Autoplay once
          if(Adapt.audio.autoPlayOnceGlobal == false){
              this.autoplayOnce = false;
          } else if(Adapt.audio.autoPlayOnceGlobal || this.model.get("_audioAssessment")._autoPlayOnce){
              this.autoplayOnce = true;
          } else {
            this.autoplayOnce = false;
          }

          // Hide controls if set in JSON or if audio is turned off
          if(this.model.get('_audioAssessment')._showControls==false || Adapt.audio.audioClip[this.audioChannel].status==0){
              this.$('.audio-inner button').hide();
          }
        },

        checkIfVisible: function() {

            if (!Adapt.assessment) {
                return false;
            }

            var isVisibleBeforeCompletion = this.model.get("_isVisibleBeforeCompletion") || false;
            var isVisible = false;

            var wasVisible = this.model.get("_isVisible");

            var assessmentModel = Adapt.assessment.get(this.model.get("_assessmentId"));
            if (!assessmentModel || assessmentModel.length === 0) return;

            var state = assessmentModel.getState();
            var isComplete = state.isComplete;
            var isAttemptInProgress = state.attemptInProgress;
            var attemptsSpent = state.attemptsSpent;
            var hasHadAttempt = (!isAttemptInProgress && attemptsSpent > 0);

            isVisible = (isVisibleBeforeCompletion && !isComplete) || hasHadAttempt;

            if (!wasVisible && isVisible) isVisible = false;

            this.model.set('_isVisible', isVisible, {pluginName: "assessmentResults"});
        },

        checkIfComplete: function() {

            if (!Adapt.assessment) {
                return false;
            }

            var assessmentModel = Adapt.assessment.get(this.model.get("_assessmentId"));
            if (!assessmentModel || assessmentModel.length === 0) return;

            var state = assessmentModel.getState();
            if (state.isComplete) {
                this.onAssessmentsComplete(state);
            } else {
                this.model.reset('hard', true);
            }
        },

        setupModelResetEvent: function() {
            if (this.model.onAssessmentsReset) return;
            this.model.onAssessmentsReset = function(state) {
                if (this.get("_assessmentId") === undefined ||
                    this.get("_assessmentId") != state.id) return;

                this.reset('hard', true);
            };
            this.model.listenTo(Adapt, 'assessments:reset', this.model.onAssessmentsReset);
        },

        postRender: function() {
            this.setReadyStatus();
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, 'assessments:complete', this.onAssessmentsComplete);
            this.listenToOnce(Adapt, 'remove', this.onRemove);
        },

        removeEventListeners: function() {
            this.stopListening(Adapt, 'assessments:complete', this.onAssessmentsComplete);
            this.stopListening(Adapt, 'remove', this.onRemove);
            this.$el.off("inview");
        },

        onAssessmentsComplete: function(state) {
            if (this.model.get("_assessmentId") === undefined ||
                this.model.get("_assessmentId") != state.id) return;
            /*
            make shortcuts to some of the key properties in the state object so that
            content developers can just use {{attemptsLeft}} in json instead of {{state.attemptsLeft}}
            */
            this.model.set( {
                _state: state,
                attempts: state.attempts,
                attemptsSpent: state.attemptsSpent,
                attemptsLeft: state.attemptsLeft,
                score: state.score,
                scoreAsPercent: state.scoreAsPercent,
                maxScore: state.maxScore,
                isPass: state.isPass
            });

            var feedbackBand = this.getFeedbackBand();

            this.setFeedback(feedbackBand);

            this.addClassesToArticle(feedbackBand);

            //show feedback component
            if(!this.model.get('_isVisible')) this.model.set('_isVisible', true, {pluginName: "assessmentResults"});

            this.render();

            this.setFeedback(feedbackBand);

            this.show();
        },

        onInview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop || this._isVisibleBottom) {
                    this.setCompletionStatus();

                    ///// Audio /////
                    if (this.audioIsEnabled && this.canAutoplay) {
                        // If audio is turned on
                        if(Adapt.audio.audioClip[this.model.get('_audioAssessment')._channel].status==1){
                            Adapt.trigger('audio:playAudio', this.audioFile, this.elementId, this.audioChannel);
                        }
                    }
                    ///// End of Audio /////

                    // Set to false to stop autoplay when inview again
                    if(this.autoplayOnce) {
                      this.canAutoplay = false;
                    }

                    // Sometimes (with mobile and virtual keyboards) inview can be triggered
                    // but the component is not _visible = true, so it does not get marked
                    // complete. Delay the unbinding of the inview listener until complete
                    if (this.model.get('_isComplete')) {
                        this.$el.off("inview");
                    }
                }
            }
        },

        toggleAudio: function(event) {
            if (event) event.preventDefault();
            Adapt.audio.audioClip[this.audioChannel].onscreenID = "";
            if ($(event.currentTarget).hasClass('playing')) {
                Adapt.trigger('audio:pauseAudio', this.audioChannel);
            } else {
                Adapt.trigger('audio:playAudio', this.audioFile, this.elementId, this.audioChannel);
            }
        },

        onRetry: function() {
            var state = this.model.get("_state");
            var assessmentModel = Adapt.assessment.get(state.id);

            this.restoreOriginalTexts();

            assessmentModel.reset();
        },

        restoreOriginalTexts: function() {
            this.model.set({
                "title": this.model.get("originalTitle"),
                "body": this.model.get("originalBody"),
                "instruction": this.model.get("originalInstruction")
            });
        },

        show: function() {
            if(!this.model.get('_isVisible')) {
                this.model.set('_isVisible', true, {pluginName: "assessmentResults"});
            }
        },

        setFeedback: function(feedbackBand) {
            var state = this.model.get("_state");
            state.feedbackBand = feedbackBand;

            // ensure any handlebars expressions in the .feedback are handled...
            this.model.set('feedback', Handlebars.compile(feedbackBand.feedback)(this.model.toJSON()));

            this.checkRetryEnabled();

            ///// Audio /////
            if (this.audioIsEnabled) {
                this.audioFile = state.feedbackBand._audio.src;
            }
            ///// End of Audio /////

            this.model.set("body", this.model.get("_completionBody"));
        },

        /**
         * If there are classes specified for the feedback band, apply them to the containing article
         * This allows for custom styling based on the band the user's score falls into
         */
        addClassesToArticle: function(feedbackBand) {

            if(!feedbackBand.hasOwnProperty('_classes')) return;

            this.$el.parents('.article').addClass(feedbackBand._classes);
        },

        getFeedbackBand: function() {
            var state = this.model.get("_state");
            var scoreProp = state.isPercentageBased ? 'scoreAsPercent' : 'score';
            var bands = _.sortBy(this.model.get("_bands"), '_score');

            for (var i = (bands.length - 1); i >= 0; i--) {
                if (state[scoreProp] >= bands[i]._score) {
                    return bands[i];
                }
            }

            return "";
        },

        checkRetryEnabled: function() {
            var state = this.model.get("_state");

            var assessmentModel = Adapt.assessment.get(state.id);
            if (!assessmentModel.canResetInPage()) return false;

            var isRetryEnabled = state.feedbackBand._allowRetry !== false;
            var isAttemptsLeft = (state.attemptsLeft > 0 || state.attemptsLeft === "infinite");
            var allowResetIfPassed = state.isPass && state.allowResetIfPassed;

            var showRetry = isRetryEnabled && (isAttemptsLeft || allowResetIfPassed);
            this.model.set("_isRetryEnabled", showRetry);

            if (showRetry) {
                var retryFeedback =  this.model.get("_retry").feedback;
                this.model.set("retryFeedback", retryFeedback);
            } else {
                this.model.set("retryFeedback", "");
            }
        },

        onRemove: function() {
            if (this.model.unsetLocking) this.model.unsetLocking("_isVisible");

            this.removeEventListeners();
        }

    }, {
        template: 'assessmentResultsAudio'
    });

    Adapt.register("assessmentResultsAudio", AssessmentResultsAudio);

    return AssessmentResultsAudio;

});
