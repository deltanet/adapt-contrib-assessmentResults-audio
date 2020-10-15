define([
  'core/js/adapt',
  './assessmentResultsAudioModel',
  './assessmentResultsAudioView'
], function(Adapt, AssessmentResultsAudioModel, AssessmentResultsAudioView) {

  return Adapt.register("assessmentResultsAudio", {
    model: AssessmentResultsAudioModel,
    view: AssessmentResultsAudioView
  });

});
