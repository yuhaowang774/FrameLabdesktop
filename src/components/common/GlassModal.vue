<script setup lang="ts">
// 磨砂玻璃弹窗：提示/确认/输入，支持二次按钮
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    message?: string
    /** 输入模式：显示输入框 */
    inputMode?: boolean
    inputValue?: string
    inputPlaceholder?: string
    confirmText?: string
    cancelText?: string
    showCancel?: boolean
  }>(),
  {
    title: '',
    message: '',
    inputMode: false,
    inputValue: '',
    inputPlaceholder: '',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: string]
  cancel: []
}>()

const localInput = ref(props.inputValue)
watch(
  () => props.modelValue,
  (open) => {
    if (open) localInput.value = props.inputValue
  },
)

function close() {
  emit('update:modelValue', false)
}
function onConfirm() {
  emit('confirm', localInput.value)
  close()
}
function onCancel() {
  emit('cancel')
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-mask" @click.self="onCancel">
      <div class="modal">
        <h3 v-if="title" class="title">{{ title }}</h3>
        <p v-if="message" class="msg">{{ message }}</p>
        <input
          v-if="inputMode"
          v-model="localInput"
          class="modal-input"
          :placeholder="inputPlaceholder"
        />
        <div class="actions">
          <button v-if="showCancel" class="btn cancel" @click="onCancel">{{ cancelText }}</button>
          <button class="btn confirm" @click="onConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  min-width: 280px;
  max-width: 90vw;
  padding: 16px 20px;
  border-radius: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
}
.title {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  margin-bottom: 8px;
  color: var(--text);
}
.msg {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-bottom: 12px;
  line-height: 16px;
}
.modal-input {
  width: 100%;
  height: 22px;
  padding: 0 8px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  height: 26px;
  padding: 0 16px;
  border-radius: 0;
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  background: var(--btn-bg);
  color: var(--text);
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn.cancel {
  background: var(--panel-2);
  color: var(--text-dim);
}
.btn.confirm {
  background: var(--accent);
  color: var(--text);
  border-color: var(--accent);
}
</style>
