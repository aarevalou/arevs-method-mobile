# Supabase en Arevs Method Mobile

La app móvil guarda la misma estructura de datos que la versión de escritorio en `app_data`, vinculada a la cuenta autenticada mediante `owner_id`.

1. Copia `.env.example` a `.env` en la raíz de `arevs-method-mobile`.
2. Completa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` con la URL del proyecto y su clave publicable (anon). Nunca uses una clave `service_role` en la aplicación móvil.
3. Habilita el acceso por correo y contraseña en Supabase Auth y configura el esquema y las políticas de acceso de `app_data` igual que para la versión de escritorio.
4. Inicia o reinicia Expo después de cambiar las variables: `npm start`.

## Compilar un APK con EAS

EAS Build no lee los archivos `.env` locales porque están excluidos del proyecto subido. En el proyecto de EAS, crea `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en el entorno `preview` para una compilación de prueba, o en `production` para una compilación de producción. Configúralas como variables disponibles para la compilación (por ejemplo, visibilidad `Sensitive`) y usa el mismo entorno que indica el perfil en `eas.json`.

El perfil `preview` genera un APK instalable. Desde la carpeta `arevs-method-mobile`, compílalo con:

```sh
eas build --platform android --profile preview
```

La compilación falla explícitamente si EAS no proporciona ambas variables, en lugar de generar un APK que muestre el aviso de configuración. Los valores `EXPO_PUBLIC_*` se incluyen en la aplicación cliente; usa únicamente la clave publicable de Supabase, nunca una clave `service_role`.

El primer inicio de sesión crea el registro de `app_data` para la cuenta si todavía no existe. Los cambios posteriores se sincronizan automáticamente; si una operación falla, la aplicación muestra el error y permite reintentarla.
