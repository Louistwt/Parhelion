const clips = {
  approvedToast: "{{id}}: approved {{name}}",
  clipApproved: "clip approved",
  speaks: "speaks",
  approveKeyframeFirst: "approve a keyframe first",
  motionPrompt: "Motion prompt (edit in Shots tab)",
  newTake: "New take",
  animate: "Animate",
  lipsync: "Lip-sync",
  needTrack: "Build the voice track first",
  noClips: "No clips yet.",
  empty: {
    title: "No shot list yet",
    body: "Build the shot list and approve keyframes first.",
  },
  title: "Clips — {{done}}/{{total}} approved",
  description:
    "The expensive stage: each approved keyframe becomes a short clip (5–10 s, trimmed to the shot in the rough cut). " +
    "Agree the storyboard first. One take per shot; regenerate only the ones you reject.",
  videoModel: "Video model",
  takes: "Takes",
  animateAll: "Animate all ready ({{count}})",
  lipsyncModel: "Lip-sync model",
  lipsyncAll: "Lip-sync speaking shots ({{count}})",
  needTrackAlert: "Lip-sync needs the voice track (Voice tab).",
};

export default clips;
