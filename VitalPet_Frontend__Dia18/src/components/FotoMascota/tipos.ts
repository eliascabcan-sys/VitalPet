// Forma con la que se MUESTRA la foto. La imagen guardada siempre es cuadrada;
// la forma se aplica al mostrarla, así que se puede cambiar sin volver a subir fotos.
export type FormaFoto = 'circulo' | 'redondeado' | 'cuadrado';
 
// Cambiar aquí si algún día el equipo prefiere otra forma para toda la app.
export const FORMA_FOTO_POR_DEFECTO: FormaFoto = 'circulo';
 