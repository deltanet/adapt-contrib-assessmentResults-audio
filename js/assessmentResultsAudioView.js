define([
  'core/js/adapt',
  'core/js/views/componentView'
], function(Adapt, ComponentView) {

  class AssessmentResultsAudioView extends ComponentView {

    events() {
      return {
        'click .js-assessment-retry-btn': 'onRetryClicked',
        'click .js-audio-toggle': 'toggleAudio'
      }
    }

    preRender() {
      this.model.setLocking('_isVisible', false);

      this.listenTo(Adapt.parentView, 'preRemove', function () {
        this.model.unsetLocking('_isVisible');
      });

      this.listenTo(this.model, {
        'change:_feedbackBand': this.addClassesToArticle,
        'change:body': this.render
      });

      if (Adapt.audio && this.model.get('_audioAssessment') && this.model.get('_audioAssessment')._isEnabled) {
        this.setupAudio();
      }
    }

    postRender() {
      this.model.checkIfAssessmentComplete();
      this.setReadyStatus();
      this.setupInviewCompletion('.component__inner', this.model.checkCompletion.bind(this.model));

      // Audio
      if (!Adapt.audio || !this.model.get('_audioAssessment')._isEnabled) return;
      // Hide controls if set in JSON or if audio is turned off
      if (this.model.get('_audioAssessment')._showControls==false || Adapt.audio.audioClip[this.audioChannel].status==0){
          this.$('.audio__inner button').hide();
      }
    }

    setupAudio() {
      // Set vars
      this.audioChannel = this.model.get("_audioAssessment")._channel;
      this.elementId = this.model.get("_id");
      this.model.set('audioFile', this.model.get("_audioAssessment")._media.src);

      this.onscreenTriggered = false;

      // Autoplay
      if (Adapt.audio.autoPlayGlobal || this.model.get("_audioAssessment")._autoplay){
          this.canAutoplay = true;
      } else {
          this.canAutoplay = false;
      }

      // Autoplay once
      if (Adapt.audio.autoPlayOnceGlobal == false){
          this.autoplayOnce = false;
      } else if(Adapt.audio.autoPlayOnceGlobal || this.model.get("_audioAssessment")._autoPlayOnce){
          this.autoplayOnce = true;
      } else {
        this.autoplayOnce = false;
      }

      // Hide controls if set in JSON or if audio is turned off
      if (this.model.get('_audioAssessment')._showControls==false || Adapt.audio.audioClip[this.audioChannel].status==0){
          this.$('.audio__inner button').hide();
      }
    }

    onInview(event, visible, visiblePartX, visiblePartY) {
      if (!visible) return;
//debugger;
      switch (visiblePartY) {
        case 'top':
          this.hasSeenTop = true;
          break;
        case 'bottom':
          this.hasSeenBottom = true;
          break;
        case 'both':
          this.hasSeenTop = this.hasSeenBottom = true;
      }

      if (!this.hasSeenTop || !this.hasSeenBottom) {
        this.onscreenTriggered = false;
        Adapt.trigger('audio:onscreenOff', this.elementId, this.audioChannel);
      };

      if (visible && this.canAutoplay && this.onscreenTriggered == false) {
        // Check if audio is set to on
        if (Adapt.audio.audioClip[this.audioChannel].status == 1) {
          Adapt.trigger('audio:playAudio', this.model.get('audioFile'), this.elementId, this.audioChannel);
        }
        // Set to false to stop autoplay when onscreen again
        if (this.autoplayOnce) {
          this.canAutoplay = false;
        }
        // Set to true to stop onscreen looping
        this.onscreenTriggered = true;
      }

      super.onInview(event, visible, visiblePartX, visiblePartY);

    }

    toggleAudio(event) {
        if (event) event.preventDefault();

        Adapt.audio.audioClip[this.audioChannel].onscreenID = "";
        if ($(event.currentTarget).hasClass('playing')) {
            Adapt.trigger('audio:pauseAudio', this.audioChannel);
        } else {
            Adapt.trigger('audio:playAudio', this.model.get('audioFile'), this.elementId, this.audioChannel);
        }
    }

    /**
     * Resets the state of the assessment and optionally redirects the user
     * back to the assessment for another attempt.
     */
    onRetryClicked() {
      const state = this.model.get('_state');

      Adapt.assessment.get(state.id).reset(null, wasReset => {
        if (!wasReset) {
          return;
        }
        if (this.model.get('_retry')._routeToAssessment === true) {
          Adapt.navigateToElement('.' + state.articleId);
        }
      });
    }

    /**
     * If there are classes specified for the feedback band, apply them to the containing article
     * This allows for custom styling based on the band the user's score falls into
     */
    addClassesToArticle(model, value) {
      if (!value || !value._classes) return;

      this.$el.parents('.article').addClass(value._classes);
    }

  }

  AssessmentResultsAudioView.template = 'assessmentResultsAudio';

  return AssessmentResultsAudioView;

});
