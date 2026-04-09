new Vue({
  el: '#app',
  data: {
    activeReplayId: 'seg-1',
    replay: {
      title: '高等数学直播课', teacher: '王教授', dateLabel: '2026-03-24',
      segments: [
        { id: 'seg-1', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
        { id: 'seg-2', video: 'https://www.w3schools.com/html/movie.mp4' },
        { id: 'seg-3', video: 'https://www.w3schools.com/html/mov_bbb.mp4' }
      ]
    }
  },
  mounted() { if (window.lucide) window.lucide.createIcons(); },
  computed: {
    activeReplay() {
      return this.replay.segments.find(s => s.id === this.activeReplayId) || this.replay.segments[0];
    }
  }
});
