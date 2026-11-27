# Sellos MAC para Cloudflare Pages

1. Agregá `functions/sellos-mac/index.js` en la raíz del proyecto de la web de MAC, junto al directorio de salida actual.
2. Creá una base de datos Cloudflare D1, ejecutá `schema.sql` y vinculala en el proyecto Pages con el nombre `MAC_SEALS_DB`.
3. Agregá el secreto `MAC_ADMIN_KEY` en el entorno de producción. Usá una clave aleatoria de al menos 32 caracteres. Guardala fuera del código.
4. Publicá el proyecto con su directorio de salida habitual usando integración Git o `npx wrangler pages deploy dist --project-name mac-discotec` desde la raíz, si el proyecto admite Direct Upload por Wrangler. El despliegue mediante arrastrar y soltar en el panel no compila la carpeta functions.
5. Agregá un enlace `<a href="/sellos-mac">Sellos MAC</a>` en la navegación de la web.
6. Abrí `/sellos-mac#admin` para crear tarjetas y registrar fiestas o referidos. Enviá al cliente el enlace personal generado. Usá la misma referencia de reserva en todas las operaciones que correspondan a esa reserva. El sistema registra por separado la fiesta del comprador y el referido para quien lo recomendó.

El saldo corresponde al período anual en Uruguay y conserva el historial en la base de datos. El valor predeterminado es del 1 de enero al 31 de diciembre. Configurá opcionalmente `MAC_SEASON_START_MONTH` (1 a 12) antes de abrir la promoción. El saldo se calcula según la fecha en que se registra la contratación. El 5% es fijo por servicio extra y la calculadora indica el importe para cada extra.
