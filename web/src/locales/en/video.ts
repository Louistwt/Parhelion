const video = {
  renderedToast: "Rendered {{file}} ({{seconds}} s)",
  title: "Rough cut",
  description:
    "Free (FFmpeg on this laptop). Uses approved clips; shots without a clip use their keyframe with a slow zoom, so you can " +
    "render an animatic as soon as the voice track exists. Output: MP4 with subtitles, a clean MP4, an SRT and a CapCut folder.",
  rendering: "Rendering… (~1 min)",
  render: "Render new version",
  noFfmpeg: "ffmpeg not found. Run <code>sudo apt install ffmpeg</code> (or reinstall with <code>uv sync</code>).",
  noFont: "No Chinese font for subtitles. Run <code>sudo apt install fonts-noto-cjk</code>.",
  sysInfo: "ffmpeg: {{source}} · subtitle font: {{font}}",
  empty: {
    title: "No rough cut yet",
    body: "Needs script.json, a shot list and timing (ideally the voice track).",
  },
  voice: "voice: {{file}}",
  noVoice: "no voice (silent)",
  stills_one: "{{count}} still shot",
  stills_other: "{{count}} still shots",
  capcutTitle: "Files for CapCut",
  copyPath: "Copy path",
  capcutHelp:
    "The folder has every shot cut to length (clips/S01.mp4…), the voice track and per-line audio, subtitles.srt and a README with the " +
    "import order. From Windows: open <code>\\\\wsl$</code> in Explorer and paste the path.",
  shotsTitle: "Shots in this cut",
  cols: { shot: "Shot", start: "Start", end: "End", source: "Source", lines: "Lines" },
  /** Labels for the render's shot sources (assemble.py); unknown values are shown as-is. */
  sources: {
    clip: "clip",
    still: "still",
    "still (not approved)": "still (not approved)",
    black: "black",
  },
};

export default video;
