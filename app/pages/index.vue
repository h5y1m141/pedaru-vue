<script setup lang="ts">
  const {count, increment, decrement, reset} = useCounter(0)
</script>
<template>
   <div>
     <h1>Counter: {{ count }}</h1>
     <button @click="increment">+</button>
     <button @click="decrement">-</button>
     <button @click="reset">Reset</button>
   </div>  
</template>