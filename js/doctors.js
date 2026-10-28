/* Datos de demostración. Reemplazar por tu API o base de datos (ver api en app.js). */
(() => {
  const img = (id, w = 640) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

  const SPECIALTIES = [
    { id: 'cardiologia', name: 'Cardiología', icon: 'heart-pulse', unit: 'Unidad Cardiovascular', img: '1576091160399-112ba8d25d1d',
      desc: 'Diagnóstico y tratamiento de afecciones cardíacas y vasculares.' },
    { id: 'pediatria', name: 'Pediatría', icon: 'baby', unit: 'Unidad Pediátrica', img: '1519494026892-80bbd2d6fd0d',
      desc: 'Cuidado integral de la salud del recién nacido, niños y adolescentes.' },
    { id: 'neurologia', name: 'Neurología', icon: 'activity', unit: 'Unidad Neurociencias', img: '1519494026892-80bbd2d6fd0d',
      desc: 'Tratamiento especializado de trastornos del sistema nervioso.' },
    { id: 'dermatologia', name: 'Dermatología', icon: 'sparkles', unit: 'Unidad de Piel', img: '1519494026892-80bbd2d6fd0d',
      desc: 'Prevención y tratamiento de enfermedades de la piel, cabello y uñas.' },
    { id: 'cirugia-torax', name: 'Cirugía Tórax y Cardiovascular', icon: 'shield-check', unit: 'Unidad Quirúrgica', img: '1579684385127-1ef15d508118',
      desc: 'Diagnóstico y tratamiento quirúrgico de afecciones en pulmones, pared torácica, corazón y vasos sanguíneos.' }
  ];

  const DOCTORS = [
    { id: 'carlos-mendoza', name: 'Dr. Carlos Mendoza', spec: 'cardiologia', sede: 'Sede Central', price: 180, img: '1537368910025-700350fe46c7' },
    { id: 'ana-torres', name: 'Dra. Ana Torres', spec: 'pediatria', sede: 'Sede Norte', price: 150, img: '1612349317150-e413f6a5b16d' },
    { id: 'mario-ramirez', name: 'Dr. Mario Ramírez', spec: 'cirugia-torax', sede: 'Sede Central', price: 200, img: '1622253692010-333f2da6031d',
      cmp: '068860', rne: '043521', profession: 'Médico Cirujano',
      university: 'Universidad Nacional Mayor de San Marcos' }
  ];

  window.MC_DATA = { SPECIALTIES, DOCTORS, SEDES: ['Sede Central', 'Sede Norte'], img };
})();
