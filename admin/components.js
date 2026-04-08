// 可复用侧滑面板组件
// 用法：<side-panel :visible.sync="show" title="标题" size="600px">内容</side-panel>
Vue.component('side-panel', {
  props: {
    visible: { type: Boolean, default: false },
    title:   { type: String,  default: '' },
    size:    { type: String,  default: '600px' }
  },
  template: `
    <el-drawer
      :title="title"
      :visible="visible"
      direction="rtl"
      :size="size"
      :wrapper-closable="true"
      @update:visible="v => $emit('update:visible', v)"
    >
      <div class="side-panel-body">
        <slot></slot>
      </div>
    </el-drawer>
  `
});
