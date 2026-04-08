new Vue({
  el: '#app',
  data: {
    activeReplayId: 'seg-1',
    replay: {
      title: '高等数学直播课回放', teacher: '王教授', dateLabel: '2026-03-24',
      segments: [
        { id: 'seg-1', title: '第一节：极限概念导入', range: '19:30 - 20:05', teacherState: '老师正常授课，20:05 临时退出', note: '讲解极限的直观理解与图像意义，结尾处老师网络异常离开。', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
        { id: 'seg-2', title: '第二节：导数几何意义', range: '20:17 - 20:52', teacherState: '老师重新进入课堂后继续授课', note: '回到课堂后继续推导导数定义，并结合例题说明切线斜率。', video: 'https://www.w3schools.com/html/movie.mp4' },
        { id: 'seg-3', title: '第三节：课堂答疑与总结', range: '20:55 - 21:12', teacherState: '老师再次返回并完成答疑收尾', note: '针对学生提问进行总结答疑，形成独立的补录回放片段。', video: 'https://www.w3schools.com/html/mov_bbb.mp4' }
      ]
    }
  },
  computed: {
    activeReplay() {
      return this.replay.segments.find(s => s.id === this.activeReplayId) || this.replay.segments[0];
    }
  }
});
