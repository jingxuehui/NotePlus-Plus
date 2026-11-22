<script setup lang="ts">
import { toast } from "@/stores/toast";
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="toast.msg"
        class="toast"
        :style="{
          background: toast.isError ? 'var(--danger)' : 'var(--accent)',
        }"
      >
        {{ toast.msg }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 18px;
  bottom: 40px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  color: #10131a;
  font-weight: 600;
  z-index: 200;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
