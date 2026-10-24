<script setup lang="ts">
defineOptions({ name: 'StorylineLogo' })

const { app } = useRuntimeConfig()
const props = defineProps<{
  hover?: boolean
  withTitle?: boolean
  animate?: boolean
}>()

const logoSrc = `${app.baseURL}${props.withTitle ? 'logo.png' : 'logo.webp'}`
</script>

<template>
  <img
    :src="logoSrc"
    alt="Störyline Logo"
    class="h-auto w-auto"
    :class="{
      'transition-transform duration-300 ease-in-out cursor-pointer hover:scale-105 hover:-rotate-1': hover,
      'animate-float': animate
    }"
  />
</template>

<style scoped>
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
</style>
