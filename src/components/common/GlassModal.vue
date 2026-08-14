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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  min-width: 280px;
  max-width: 90vw;
  padding: 20px;
  border-radius: 14px;
  background: rgba(30, 30, 30, 0.6);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  color: #fff;
}
.title {
  font-size: 16px;
  margin-bottom: 8px;
}
.msg {
  font-size: 14px;
  color: #ccc;
  margin-bottom: 12px;
  line-height: 1.5;
}
.modal-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 14px;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  font-size: 13px;
}
.btn.cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #ddd;
}
.btn.confirm {
  background: rgba(120, 170, 255, 0.85);
  color: #fff;
  border-color: rgba(120, 170, 255, 0.9);
}
</style>
