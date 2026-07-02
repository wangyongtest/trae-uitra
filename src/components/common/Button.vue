<script setup lang="ts">
import { computed } from 'vue'
import Spinner from './Spinner.vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button'
})

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

// 计算样式类
const buttonClasses = computed(() => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-500 text-white focus:ring-primary-500 active:bg-primary-700',
    secondary: 'bg-dark-700 hover:bg-dark-600 text-dark-100 focus:ring-dark-500 active:bg-dark-800',
    ghost: 'bg-transparent hover:bg-dark-700 text-dark-300 hover:text-dark-100 focus:ring-dark-500',
    danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 active:bg-red-700'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2'
  }

  return [base, variants[props.variant], sizes[props.size]]
})

const handleClick = (e: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', e)
  }
}
</script>

<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <Spinner v-if="loading" size="sm" />
    <slot />
  </button>
</template>
