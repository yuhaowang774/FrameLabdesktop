<script setup lang="ts">
// 参数剪贴板弹窗宿主（全局唯一挂载于 App.vue）：
// 粘贴确认 + 同步/粘贴结果弹窗。状态在 useParamClipboard 模块单例中，
// 编辑页底栏与胶片条右键菜单触发同一套弹窗，避免各组件重复挂载。
import { useParamClipboard } from '../../composables/useParamClipboard'
import GlassModal from '../common/GlassModal.vue'

const { syncTargets, pasteConfirmOpen, syncResultOpen, syncResultMsg, confirmPaste, doApplyPasted } =
  useParamClipboard()
</script>

<template>
  <!-- 粘贴参数确认（存在勾选目标时） -->
  <GlassModal
    v-model="pasteConfirmOpen"
    title="粘贴参数"
    :message="`将把粘贴的参数应用到当前照片，并同步到已选中的 ${syncTargets.length} 张照片（各照片保留自身 EXIF 信息，可在各自历史中撤销）。确定继续？`"
    confirm-text="应用"
    cancel-text="仅当前照片"
    @confirm="confirmPaste"
    @cancel="doApplyPasted"
  />
  <GlassModal v-model="syncResultOpen" title="同步完成" :message="syncResultMsg" confirm-text="知道了" />
</template>
