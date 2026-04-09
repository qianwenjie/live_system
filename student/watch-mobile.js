new Vue({
  el: '#app',
  data: {
    inputMsg: '', isFullscreen: false,
    clockTimer: null, nowTs: Date.now(), sending: false, isMuted: false,
    room: {
      title: '高等数学直播课', teacher: '王教授', badge: '进行中',
      description: '进入后点击开始观看，即可进入课堂直播画面。',
      onlineCount: 42, chatOpen: true, liveBaseSeconds: 1380,
      network: '网络良好', liveHint: '老师当前正在共享课件与板书内容。', started: false
    },
    messages: [
      { id: 1, user: '教务助手', type: 'system', time: '19:20', content: '课程已开放进入，请保持网络稳定。' },
      { id: 2, user: '张同学', type: 'student', time: '19:31', content: '老师声音清楚，可以开始。' },
      { id: 3, user: '王教授', type: 'teacher', time: '19:32', content: '今天讲极限和导数的直观理解。' }
    ]
  },
  computed: {
    currentDuration() {
      const s = this.room.liveBaseSeconds + Math.floor((this.nowTs - this.bootAt) / 1000);
      return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    },
    canChat() { return this.room.chatOpen && !this.isMuted; },
    muteTip() {
      if (this.isMuted) return '您已被禁言，无法发送消息。';
      if (!this.room.chatOpen) return '当前课堂暂不开放聊天。';
      return '';
    }
  },
  created() {
    this.bootAt = Date.now();
    this.clockTimer = setInterval(() => { this.nowTs = Date.now(); }, 1000);
  },
  mounted() { if (window.lucide) this.$nextTick(() => window.lucide.createIcons()); },
  beforeDestroy() { clearInterval(this.clockTimer); },
  methods: {
    startLive() {
      this.room.started = true;
      this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
    },
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
    },
    sendMsg() {
      if (!this.canChat || !this.inputMsg || this.sending) return;
      this.sending = true;
      const text = this.inputMsg.slice(0, 120);
      setTimeout(() => {
        this.messages.push({ id: Date.now(), user: '我', type: 'student', time: this.now(), content: text });
        this.inputMsg = '';
        this.sending = false;
        this.$nextTick(() => { const el = this.$refs.msgList; if (el) el.scrollTop = el.scrollHeight; });
      }, 220);
    },
    now() { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  }
});
