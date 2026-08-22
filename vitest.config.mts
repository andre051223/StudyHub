import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los cálculos de estadísticas dependen de la zona horaria local: agrupar
    // por día en UTC desplazaba el estudio nocturno al día siguiente. Fijamos
    // una zona con offset negativo —la real de los usuarios— para que los
    // tests fallen si alguien vuelve a usar toISOString() para agrupar días.
    env: { TZ: 'America/Bogota' },
    include: ['lib/**/*.test.ts'],
  },
});
