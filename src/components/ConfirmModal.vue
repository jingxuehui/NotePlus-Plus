<script setup lang="ts">
import { ui, resolveModal } from "@/stores/ui";
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.modal" class="modal-mask" @click.self="resolveModal(ui.modal!.choices[ui.modal!.choices.length - 1])">
      <div class="modal-box">
        <h3 class="font-semibold text-[14px]">{{ ui.modal.title }}</h3>
        <p class="mt-2 text-[13px] text-muted leading-6">{{ ui.modal.message }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            v-for="(choice, i) in ui.modal.choices"
            :key="choice"
            class="np-btn"
            :class="{ primary: i === 0, danger: ui.modal!.danger }"
            @click="resolveModal(choice)"
          >
            {{ choice }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18vh;
  z-index: 100;
}
.modal-box {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 6px);
  padding: 20px 22px;
  width: 380px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}
.np-btn.danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
</style>
