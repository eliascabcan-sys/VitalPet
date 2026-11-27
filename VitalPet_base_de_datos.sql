-- ============================================================
-- VitalPet - Base de datos completa (un solo archivo)
-- ============================================================
-- Reune las tablas de los modelos + todas las migraciones:
--   p1_esquema, p2_certificados, p2_esquema_sanitario, p3_seguimiento,
--   v8, v9 (triaje y reescalado), v9_automatizacion, p10_autorizaciones
--   (fecha de nacimiento del dueno + consentimientos de adultos mayores)
--   y dia 12 (contacto directo en alertas graves).
--
-- Es IDEMPOTENTE: sirve para una base vacia y tambien para una base
-- que ya tiene datos (no borra nada).
--
-- Uso:
--   psql -U postgres -c "CREATE DATABASE \"VitalPet\""      (solo la primera vez)
--   psql -U postgres -d VitalPet -v ON_ERROR_STOP=1 -f VitalPet_base_de_datos.sql
--
-- Las cuentas admin y veterinario NO se crean aqui: las siembra main.py
-- al arrancar (necesitan la contrasena encriptada y salen del .env).
-- ============================================================
BEGIN;

-- ============================================================
-- 1. TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    "idUsuario"     SERIAL PRIMARY KEY,
    "nombre"        VARCHAR(100) NOT NULL,
    "apellido"      VARCHAR(100) NOT NULL,
    "documento"     VARCHAR(20)  UNIQUE,
    "telefono"      VARCHAR(20),
    "email"         VARCHAR(100) NOT NULL UNIQUE,
    "contrasena"    VARCHAR(255) NOT NULL,
    "rol"           VARCHAR(20)  DEFAULT 'dueno',
    "estado"        VARCHAR(20)  DEFAULT 'activo',
    "fechaCreacion" TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    "google_id"     VARCHAR(255) UNIQUE
);

CREATE TABLE IF NOT EXISTS veterinarios (
    "idVeterinario"      SERIAL PRIMARY KEY,
    "especialidad"       VARCHAR(100),
    "tarjetaProfesional" VARCHAR(50) NOT NULL UNIQUE,
    "estado"             VARCHAR(20) DEFAULT 'activo',
    "firma"              TEXT,
    "idUsuario"          INT NOT NULL UNIQUE REFERENCES usuarios("idUsuario") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tokens_recuperacion (
    "idToken"   SERIAL PRIMARY KEY,
    "email"     VARCHAR(100) NOT NULL,
    "token"     VARCHAR(255) NOT NULL UNIQUE,
    "expira_en" TIMESTAMP    NOT NULL,
    "usado"     BOOLEAN      DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS acudientes (
    "idAcudiente" SERIAL PRIMARY KEY,
    "idUsuario"   INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE ON DELETE CASCADE,
    "nombre"      VARCHAR(100) NOT NULL,
    "apellido"    VARCHAR(100) NOT NULL,
    "documento"   VARCHAR(20),
    "telefono"    VARCHAR(20)  NOT NULL,
    "email"       VARCHAR(100),
    "parentesco"  VARCHAR(50),
    "autorizado"  BOOLEAN      NOT NULL DEFAULT TRUE,
    "estado"      VARCHAR(20)  NOT NULL DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS mascotas (
    "idMascota"       SERIAL PRIMARY KEY,
    "nombre_mascota"  VARCHAR(100) NOT NULL,
    "especie"         VARCHAR(50)  NOT NULL,
    "raza"            VARCHAR(100),
    "sexo"            VARCHAR(10),
    "color"           VARCHAR(50),
    "peso_kg"         NUMERIC(5,2),
    "fechaNacimiento" DATE,
    "estado"          VARCHAR(20)  DEFAULT 'activo',
    "foto"            VARCHAR(64),
    "idUsuario"       INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE
);

-- Inventario
CREATE TABLE IF NOT EXISTS categorias (
    "idCategoria"      SERIAL PRIMARY KEY,
    "nombre_categoria" VARCHAR(100) NOT NULL UNIQUE,
    "estado"           VARCHAR(20)  DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS subcategorias (
    "idSubcategoria"      SERIAL PRIMARY KEY,
    "idCategoria"         INT NOT NULL REFERENCES categorias("idCategoria") ON UPDATE CASCADE,
    "nombre_subcategoria" VARCHAR(100) NOT NULL,
    "estado"              VARCHAR(20)  NOT NULL DEFAULT 'activo',
    CONSTRAINT uq_subcategoria_categoria_nombre UNIQUE ("idCategoria","nombre_subcategoria")
);

CREATE TABLE IF NOT EXISTS productos (
    "idProducto"           SERIAL PRIMARY KEY,
    "nombre_producto"      VARCHAR(100)  NOT NULL UNIQUE,
    "precio"               NUMERIC(10,2) NOT NULL,
    "stock"                INT           DEFAULT 0,
    "estado"               VARCHAR(20)   DEFAULT 'activo',
    "idCategoria"          INT NOT NULL REFERENCES categorias("idCategoria") ON UPDATE CASCADE,
    "requierePrescripcion" BOOLEAN       NOT NULL DEFAULT FALSE,
    "idSubcategoria"       INT REFERENCES subcategorias("idSubcategoria") ON UPDATE CASCADE
);

-- Citas
CREATE TABLE IF NOT EXISTS franjas_horarias (
    "idFranja"    SERIAL PRIMARY KEY,
    "nombre"      VARCHAR(50) NOT NULL UNIQUE,
    "hora_inicio" TIME        NOT NULL,
    "hora_fin"    TIME        NOT NULL,
    "cupo_maximo" INT         NOT NULL DEFAULT 6,
    "estado"      VARCHAR(20) NOT NULL DEFAULT 'activo',
    CHECK ("hora_fin" > "hora_inicio")
);

CREATE TABLE IF NOT EXISTS citas (
    "idCita"               SERIAL PRIMARY KEY,
    "fechaHora"            TIMESTAMP   NOT NULL,
    "motivo"               TEXT,
    "estado"               VARCHAR(20) DEFAULT 'pendiente',
    "idUsuario"            INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE,
    "idMascota"            INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idVeterinario"        INT REFERENCES veterinarios("idVeterinario") ON UPDATE CASCADE,
    "idFranja"             INT REFERENCES franjas_horarias("idFranja") ON UPDATE CASCADE,
    "canal_contacto"       VARCHAR(20) NOT NULL DEFAULT 'app',
    "recordatorio_enviado" BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Historia clinica
CREATE TABLE IF NOT EXISTS historial_clinico (
    "idHistorial"             SERIAL PRIMARY KEY,
    "fechaRegistro"           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    "motivo_consulta"         VARCHAR(255),
    "diagnostico"             TEXT,
    "tratamiento"             TEXT,
    "medicamentos"            TEXT,
    "observaciones"           TEXT,
    "peso_consulta"           NUMERIC(5,2),
    "temperatura"             NUMERIC(4,1),
    "proxima_cita"            DATE,
    "frecuencia_cardiaca"     INT,
    "frecuencia_respiratoria" INT,
    "mucosas"                 VARCHAR(50),
    "tllc_seg"                NUMERIC(3,1),
    "hidratacion"             VARCHAR(30),
    "condicion_corporal"      INT,
    "estado"                  VARCHAR(20)  DEFAULT 'activo',
    "prescripcionUsada"       BOOLEAN      NOT NULL DEFAULT FALSE,
    "idMascota"               INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idUsuario"               INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS historial_secciones (
    "idSeccion"     SERIAL PRIMARY KEY,
    "idHistorial"   INT NOT NULL REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE ON DELETE CASCADE,
    "tipo"          VARCHAR(40) NOT NULL,
    "contenido"     TEXT,
    "orden"         INT NOT NULL DEFAULT 1,
    "actualizadoEn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_historial_seccion_tipo UNIQUE ("idHistorial","tipo")
);

CREATE TABLE IF NOT EXISTS formulas_medicas (
    "idFormula"              SERIAL PRIMARY KEY,
    "idHistorial"            INT NOT NULL REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE ON DELETE CASCADE,
    "fecha"                  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indicaciones_generales" TEXT,
    "estado"                 VARCHAR(20) NOT NULL DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS formula_medicamentos (
    "idFormulaMedicamento" SERIAL PRIMARY KEY,
    "idFormula"            INT NOT NULL REFERENCES formulas_medicas("idFormula") ON UPDATE CASCADE ON DELETE CASCADE,
    "idProducto"           INT REFERENCES productos("idProducto") ON UPDATE CASCADE,
    "nombre_medicamento"   VARCHAR(150) NOT NULL,
    "presentacion"         VARCHAR(100),
    "dosis"                VARCHAR(100) NOT NULL,
    "via_administracion"   VARCHAR(50),
    "frecuencia"           VARCHAR(100) NOT NULL,
    "duracion_dias"        INT,
    "cantidad"             INT,
    "indicaciones"         TEXT
);

CREATE TABLE IF NOT EXISTS examenes_laboratorio (
    "idExamen"          SERIAL PRIMARY KEY,
    "idHistorial"       INT NOT NULL REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE,
    "idMascota"         INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idUsuarioSolicita" INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE,
    "categoria"         VARCHAR(50)  NOT NULL,
    "tipo_examen"       VARCHAR(150) NOT NULL,
    "estado"            VARCHAR(20)  NOT NULL DEFAULT 'solicitado',
    "fecha_solicitud"   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resultado"   TIMESTAMP,
    "resultado"         TEXT,
    "valores"           JSONB,
    "archivo_url"       VARCHAR(500),
    "observaciones"     TEXT
);

CREATE TABLE IF NOT EXISTS certificados (
    "idCertificado"       SERIAL PRIMARY KEY,
    "codigo"              VARCHAR(30) NOT NULL UNIQUE,
    "tipo"                VARCHAR(30) NOT NULL,
    "idMascota"           INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idHistorial"         INT REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE,
    "idUsuario"           INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE,
    "fechaEmision"        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta"       DATE,
    "contenido"           TEXT        NOT NULL,
    "estado"              VARCHAR(20) NOT NULL DEFAULT 'emitido',
    "mascota_nombre"      VARCHAR(100),
    "mascota_especie"     VARCHAR(50),
    "mascota_raza"        VARCHAR(100),
    "dueno_nombre"        VARCHAR(150),
    "nombre_veterinario"  VARCHAR(150),
    "tarjeta_profesional" VARCHAR(50),
    "firma_veterinario"   TEXT,
    "lote"                VARCHAR(50),
    "codigo_verificacion" VARCHAR(16),
    "huella"              VARCHAR(64),
    "motivo_anulacion"    TEXT,
    "fechaAnulacion"      TIMESTAMP
);

-- Esquema sanitario (vacunas, desparasitaciones, antipulgas)
CREATE TABLE IF NOT EXISTS vacunas (
    "idVacuna"         SERIAL PRIMARY KEY,
    "tipo"             VARCHAR(20)  NOT NULL DEFAULT 'vacuna',
    "nombre_vacuna"    VARCHAR(100) NOT NULL,
    "fecha_aplicacion" DATE         NOT NULL,
    "proxima_dosis"    DATE,
    "lote"             VARCHAR(50),
    "veterinario"      VARCHAR(100),
    "observaciones"    TEXT,
    "estado"           VARCHAR(20)  NOT NULL DEFAULT 'activo',
    "idMascota"        INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS derivaciones (
    "idDerivacion"        SERIAL PRIMARY KEY,
    "idHistorialOrigen"   INT NOT NULL REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE,
    "idMascota"           INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idVeterinarioOrigen" INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE,
    "especialidadDestino" VARCHAR(100) NOT NULL,
    "estado"              VARCHAR(20)  DEFAULT 'pendiente',
    "fechaCreacion"       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Ventas
CREATE TABLE IF NOT EXISTS ventas (
    "idVenta"     SERIAL PRIMARY KEY,
    "fecha"       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    "total"       NUMERIC(10,2) NOT NULL DEFAULT 0,
    "estado"      VARCHAR(20)   DEFAULT 'pendiente',
    "idUsuario"   INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE,
    "idHistorial" INT REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS detalle_venta (
    "idDetalle_Venta" SERIAL PRIMARY KEY,
    "cantidad"        INT           NOT NULL,
    "precioUnitario"  NUMERIC(10,2) NOT NULL,
    "subtotal"        NUMERIC(10,2) NOT NULL,
    "idProducto"      INT NOT NULL REFERENCES productos("idProducto") ON UPDATE CASCADE,
    "idVenta"         INT NOT NULL REFERENCES ventas("idVenta") ON UPDATE CASCADE
);

-- Reportes de salud del dueno (triaje de 5 niveles)
CREATE TABLE IF NOT EXISTS reportes_salud (
    "idReporte"     SERIAL PRIMARY KEY,
    "fecha"         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alimentacion"  VARCHAR(50)  NOT NULL,
    "actividad"     VARCHAR(50)  NOT NULL,
    "sintomas"      VARCHAR(100) NOT NULL,
    "observaciones" TEXT,
    "nivel"         VARCHAR(10) NOT NULL DEFAULT 'verde',
    "revisado"      BOOLEAN     NOT NULL DEFAULT FALSE,
    "idMascota"     INT NOT NULL REFERENCES mascotas("idMascota") ON UPDATE CASCADE,
    "idUsuario"     INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE
);

-- Motor de seguimiento
CREATE TABLE IF NOT EXISTS plantillas_seguimiento (
    "idPlantilla" SERIAL PRIMARY KEY,
    "nombre"      VARCHAR(100) NOT NULL,
    "tipo_animal" VARCHAR(50)  NOT NULL,
    "diagnostico" VARCHAR(150) NOT NULL,
    "estado"      VARCHAR(20)  DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS preguntas_plantilla (
    "idPregunta"             SERIAL PRIMARY KEY,
    "idPlantilla"            INT NOT NULL REFERENCES plantillas_seguimiento("idPlantilla") ON UPDATE CASCADE,
    "texto_pregunta"         VARCHAR(255) NOT NULL,
    "dias_desde_diagnostico" INT NOT NULL,
    "orden"                  INT DEFAULT 1,
    "nivel_alerta_si_mal"    VARCHAR(10) DEFAULT 'naranja',
    "tipo_respuesta"         VARCHAR(30) NOT NULL DEFAULT 'bien_regular_mal',
    "opciones"               JSONB,
    "estado"                 VARCHAR(20) DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS seguimientos (
    "idSeguimiento"     SERIAL PRIMARY KEY,
    "idHistorial"       INT NOT NULL REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE,
    "idPlantilla"       INT NOT NULL REFERENCES plantillas_seguimiento("idPlantilla") ON UPDATE CASCADE,
    "fecha_diagnostico" TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    "estado"            VARCHAR(20) DEFAULT 'en_curso'
);

CREATE TABLE IF NOT EXISTS respuestas_seguimiento (
    "idRespuesta"      SERIAL PRIMARY KEY,
    "idSeguimiento"    INT NOT NULL REFERENCES seguimientos("idSeguimiento") ON UPDATE CASCADE,
    "idPregunta"       INT NOT NULL REFERENCES preguntas_plantilla("idPregunta") ON UPDATE CASCADE,
    "fecha_programada" TIMESTAMP NOT NULL,
    "fecha_envio"      TIMESTAMP,
    "estado_envio"     VARCHAR(20) DEFAULT 'pendiente',
    "respuesta"        VARCHAR(255),
    "fecha_respuesta"  TIMESTAMP,
    "puntos"           INT     NOT NULL DEFAULT 0,
    "nivel"            VARCHAR(10),
    "bandera_roja"     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS alertas_seguimiento (
    "idAlerta"               SERIAL PRIMARY KEY,
    "idSeguimiento"          INT NOT NULL REFERENCES seguimientos("idSeguimiento") ON UPDATE CASCADE,
    "idRespuesta"            INT NOT NULL REFERENCES respuestas_seguimiento("idRespuesta") ON UPDATE CASCADE,
    "nivel"                  VARCHAR(10) NOT NULL,
    "fecha_generada"         TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    "notificado_veterinario" BOOLEAN     DEFAULT FALSE,
    "notificado_dueno"       BOOLEAN     DEFAULT FALSE,
    "nivel_original"         VARCHAR(10),
    "fecha_nivel"            TIMESTAMP,
    "veces_reescalada"       INT     NOT NULL DEFAULT 0,
    "puntos"                 INT     NOT NULL DEFAULT 0,
    "bandera_roja"           BOOLEAN NOT NULL DEFAULT FALSE,
    "estado"                 VARCHAR(20) NOT NULL DEFAULT 'pendiente'
);


-- ============================================================
-- 2. COLUMNAS NUEVAS PARA BASES YA EXISTENTES
--    (en una base vacia ya existen, no hace nada)
-- ============================================================

-- p2_certificados
ALTER TABLE veterinarios ADD COLUMN IF NOT EXISTS "firma" TEXT;

ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "mascota_nombre"      VARCHAR(100);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "mascota_especie"     VARCHAR(50);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "mascota_raza"        VARCHAR(100);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "dueno_nombre"        VARCHAR(150);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "nombre_veterinario"  VARCHAR(150);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "tarjeta_profesional" VARCHAR(50);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "firma_veterinario"   TEXT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "lote"                VARCHAR(50);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "codigo_verificacion" VARCHAR(16);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "huella"              VARCHAR(64);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "motivo_anulacion"    TEXT;
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS "fechaAnulacion"      TIMESTAMP;

-- p1_esquema
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "frecuencia_cardiaca"     INT;
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "frecuencia_respiratoria" INT;
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "mucosas"                 VARCHAR(50);
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "tllc_seg"                NUMERIC(3,1);
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "hidratacion"             VARCHAR(30);
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "condicion_corporal"      INT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS "idSubcategoria" INT REFERENCES subcategorias("idSubcategoria") ON UPDATE CASCADE;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS "idFranja"       INT REFERENCES franjas_horarias("idFranja") ON UPDATE CASCADE;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS "canal_contacto" VARCHAR(20) NOT NULL DEFAULT 'app';

-- (faltaba en las migraciones: el modelo Cita la usa para los recordatorios)
ALTER TABLE citas ADD COLUMN IF NOT EXISTS "recordatorio_enviado" BOOLEAN NOT NULL DEFAULT FALSE;

-- p2_esquema_sanitario
ALTER TABLE vacunas ADD COLUMN IF NOT EXISTS "tipo" VARCHAR(20) NOT NULL DEFAULT 'vacuna';

-- p3_seguimiento
ALTER TABLE preguntas_plantilla     ADD COLUMN IF NOT EXISTS "tipo_respuesta" VARCHAR(30) NOT NULL DEFAULT 'bien_regular_mal';
ALTER TABLE preguntas_plantilla     ADD COLUMN IF NOT EXISTS "opciones"       JSONB;
ALTER TABLE respuestas_seguimiento  ADD COLUMN IF NOT EXISTS "puntos"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE respuestas_seguimiento  ADD COLUMN IF NOT EXISTS "nivel"          VARCHAR(10);
ALTER TABLE respuestas_seguimiento  ADD COLUMN IF NOT EXISTS "bandera_roja"   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alertas_seguimiento     ADD COLUMN IF NOT EXISTS "puntos"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alertas_seguimiento     ADD COLUMN IF NOT EXISTS "bandera_roja"   BOOLEAN NOT NULL DEFAULT FALSE;

-- v8
ALTER TABLE productos         ADD COLUMN IF NOT EXISTS "requierePrescripcion" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE historial_clinico ADD COLUMN IF NOT EXISTS "prescripcionUsada"    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ventas            ADD COLUMN IF NOT EXISTS "idHistorial" INT REFERENCES historial_clinico("idHistorial") ON UPDATE CASCADE;

-- v9 (reescalado de alertas). Los UPDATE solo corren la primera vez que
-- se agregan las columnas, para no pisar datos al volver a ejecutar el script.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema()
                     AND table_name = 'alertas_seguimiento' AND column_name = 'nivel_original') THEN
        ALTER TABLE alertas_seguimiento ADD COLUMN "nivel_original"   VARCHAR(10);
        ALTER TABLE alertas_seguimiento ADD COLUMN "fecha_nivel"      TIMESTAMP;
        ALTER TABLE alertas_seguimiento ADD COLUMN "veces_reescalada" INT NOT NULL DEFAULT 0;

        -- El nivel actual es el original y el tiempo cuenta desde ahora (UTC).
        UPDATE alertas_seguimiento SET nivel_original = nivel WHERE nivel_original IS NULL;
        UPDATE alertas_seguimiento SET fecha_nivel = (NOW() AT TIME ZONE 'UTC') WHERE fecha_nivel IS NULL;

        -- Reportes viejos que eran "todo normal": antes verde, ahora azul.
        UPDATE reportes_salud
           SET "nivel" = 'azul'
         WHERE "nivel" = 'verde'
           AND lower("alimentacion") = 'sí, normal'
           AND lower("actividad")    = 'normal'
           AND lower("sintomas")     = 'ninguno';
    END IF;
END $$;

-- v9_automatizacion (estado del ciclo de vida de la alerta)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema()
                     AND table_name = 'alertas_seguimiento' AND column_name = 'estado') THEN
        ALTER TABLE alertas_seguimiento ADD COLUMN "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente';
        -- Las que el veterinario ya habia visto quedan como "vista".
        UPDATE alertas_seguimiento SET estado = 'vista'
         WHERE notificado_veterinario = TRUE AND estado = 'pendiente';
    END IF;
END $$;


-- ============================================================
-- 3. NORMALIZACION DE DATOS VIEJOS (p1_esquema)
--    Va antes de los CHECK para que no fallen en bases con datos.
-- ============================================================
UPDATE mascotas SET especie = CASE lower(especie)
    WHEN 'canino' THEN 'Canino'   WHEN 'perro' THEN 'Canino'
    WHEN 'felino' THEN 'Felino'   WHEN 'gato' THEN 'Felino'
    WHEN 'roedor' THEN 'Roedor'   WHEN 'conejo' THEN 'Roedor' WHEN 'hamster' THEN 'Roedor'
    WHEN 'aves' THEN 'Aves'       WHEN 'pajaro' THEN 'Aves'   WHEN 'pájaro' THEN 'Aves'
    ELSE 'No convencional' END;
UPDATE mascotas SET sexo = lower(sexo) WHERE sexo IS NOT NULL;
UPDATE mascotas SET sexo = NULL WHERE sexo NOT IN ('macho','hembra');
UPDATE plantillas_seguimiento SET tipo_animal = 'Canino' WHERE lower(tipo_animal) = 'perro';
UPDATE plantillas_seguimiento SET tipo_animal = 'Felino' WHERE lower(tipo_animal) = 'gato';
UPDATE preguntas_plantilla SET "tipo_respuesta" = 'bien_regular_mal'
 WHERE "tipo_respuesta" IS NULL OR "tipo_respuesta" = '';


-- ============================================================
-- 4. RESTRICCIONES (CHECK)
-- ============================================================
ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS ck_mascotas_especie;
ALTER TABLE mascotas ADD CONSTRAINT ck_mascotas_especie
    CHECK ("especie" IN ('Canino','Felino','Roedor','Aves','No convencional'));

ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS ck_mascotas_sexo;
ALTER TABLE mascotas ADD CONSTRAINT ck_mascotas_sexo
    CHECK ("sexo" IS NULL OR "sexo" IN ('macho','hembra'));

-- CORREGIDO: la migracion original solo permitia 9 tipos, pero el modelo y el
-- frontend tambien usan 'procedimientos' e 'inyectologia' (daban error al guardar).
ALTER TABLE historial_secciones DROP CONSTRAINT IF EXISTS historial_secciones_tipo_check;
ALTER TABLE historial_secciones DROP CONSTRAINT IF EXISTS ck_historial_secciones_tipo;
ALTER TABLE historial_secciones ADD CONSTRAINT ck_historial_secciones_tipo
    CHECK ("tipo" IN (
        'anamnesis','examen_fisico','diagnostico_presuntivo','plan_diagnostico',
        'diagnostico_definitivo','tratamiento','pronostico','recomendaciones','evolucion',
        'procedimientos','inyectologia'));

ALTER TABLE examenes_laboratorio DROP CONSTRAINT IF EXISTS examenes_laboratorio_estado_check;
ALTER TABLE examenes_laboratorio DROP CONSTRAINT IF EXISTS ck_examenes_estado;
ALTER TABLE examenes_laboratorio ADD CONSTRAINT ck_examenes_estado
    CHECK ("estado" IN ('solicitado','en_proceso','entregado','cancelado'));

ALTER TABLE certificados DROP CONSTRAINT IF EXISTS certificados_tipo_check;
ALTER TABLE certificados DROP CONSTRAINT IF EXISTS ck_certificados_tipo;
ALTER TABLE certificados ADD CONSTRAINT ck_certificados_tipo
    CHECK ("tipo" IN ('salud','vacunacion','viaje','esterilizacion','defuncion','otro'));

ALTER TABLE certificados DROP CONSTRAINT IF EXISTS certificados_estado_check;
ALTER TABLE certificados DROP CONSTRAINT IF EXISTS ck_certificados_estado;
ALTER TABLE certificados ADD CONSTRAINT ck_certificados_estado
    CHECK ("estado" IN ('emitido','anulado'));

ALTER TABLE citas DROP CONSTRAINT IF EXISTS ck_citas_canal;
ALTER TABLE citas ADD CONSTRAINT ck_citas_canal
    CHECK ("canal_contacto" IN ('app','telefono','presencial','correo','urgente'));

ALTER TABLE vacunas DROP CONSTRAINT IF EXISTS ck_vacunas_tipo;
ALTER TABLE vacunas ADD CONSTRAINT ck_vacunas_tipo
    CHECK ("tipo" IN ('vacuna','desparasitacion','antipulgas'));


-- ============================================================
-- 5. INDICES
-- ============================================================
-- p1_esquema
CREATE INDEX IF NOT EXISTS idx_acudientes_usuario        ON acudientes("idUsuario");
CREATE INDEX IF NOT EXISTS idx_historial_secciones_hist  ON historial_secciones("idHistorial");
CREATE INDEX IF NOT EXISTS idx_formulas_historial        ON formulas_medicas("idHistorial");
CREATE INDEX IF NOT EXISTS idx_formula_med_formula       ON formula_medicamentos("idFormula");
CREATE INDEX IF NOT EXISTS idx_examenes_historial        ON examenes_laboratorio("idHistorial");
CREATE INDEX IF NOT EXISTS idx_examenes_mascota          ON examenes_laboratorio("idMascota");
CREATE INDEX IF NOT EXISTS idx_certificados_mascota      ON certificados("idMascota");
CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria   ON subcategorias("idCategoria");
-- p2_certificados
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificados_codigo_verificacion
    ON certificados ("codigo_verificacion");
-- p2_esquema_sanitario
CREATE INDEX IF NOT EXISTS idx_vacunas_mascota_tipo      ON vacunas("idMascota","tipo");
-- v8
CREATE INDEX IF NOT EXISTS idx_reportes_salud_usuario    ON reportes_salud("idUsuario");
CREATE INDEX IF NOT EXISTS idx_reportes_salud_mascota    ON reportes_salud("idMascota");
-- v9_automatizacion
CREATE INDEX IF NOT EXISTS idx_alertas_estado            ON alertas_seguimiento("estado");
CREATE INDEX IF NOT EXISTS idx_respuestas_estado_envio   ON respuestas_seguimiento("estado_envio");

-- Agregados: llaves foraneas y columnas que el sistema consulta seguido
CREATE INDEX IF NOT EXISTS idx_mascotas_usuario          ON mascotas("idUsuario");
CREATE INDEX IF NOT EXISTS idx_productos_categoria       ON productos("idCategoria");
CREATE INDEX IF NOT EXISTS idx_productos_subcategoria    ON productos("idSubcategoria");
CREATE INDEX IF NOT EXISTS idx_citas_usuario             ON citas("idUsuario");
CREATE INDEX IF NOT EXISTS idx_citas_mascota             ON citas("idMascota");
CREATE INDEX IF NOT EXISTS idx_citas_veterinario_fecha   ON citas("idVeterinario","fechaHora");
CREATE INDEX IF NOT EXISTS idx_citas_franja              ON citas("idFranja");
CREATE INDEX IF NOT EXISTS idx_historial_mascota         ON historial_clinico("idMascota");
CREATE INDEX IF NOT EXISTS idx_historial_usuario         ON historial_clinico("idUsuario");
CREATE INDEX IF NOT EXISTS idx_ventas_usuario            ON ventas("idUsuario");
CREATE INDEX IF NOT EXISTS idx_ventas_historial          ON ventas("idHistorial");
CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta       ON detalle_venta("idVenta");
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto    ON detalle_venta("idProducto");
CREATE INDEX IF NOT EXISTS idx_derivaciones_mascota      ON derivaciones("idMascota");
CREATE INDEX IF NOT EXISTS idx_derivaciones_historial    ON derivaciones("idHistorialOrigen");
CREATE INDEX IF NOT EXISTS idx_preguntas_plantilla       ON preguntas_plantilla("idPlantilla");
CREATE INDEX IF NOT EXISTS idx_seguimientos_historial    ON seguimientos("idHistorial");
CREATE INDEX IF NOT EXISTS idx_seguimientos_plantilla    ON seguimientos("idPlantilla");
CREATE INDEX IF NOT EXISTS idx_respuestas_seguimiento    ON respuestas_seguimiento("idSeguimiento");
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta       ON respuestas_seguimiento("idPregunta");
CREATE INDEX IF NOT EXISTS idx_alertas_seguimiento       ON alertas_seguimiento("idSeguimiento");
CREATE INDEX IF NOT EXISTS idx_alertas_respuesta         ON alertas_seguimiento("idRespuesta");
CREATE INDEX IF NOT EXISTS idx_tokens_email              ON tokens_recuperacion("email");


-- ============================================================
-- 6. PROTECCION DE CERTIFICADOS (p2_certificados)
--    Aunque alguien escriba SQL a mano, un certificado emitido no se
--    puede cambiar ni borrar. Lo unico permitido es anularlo
--    (estado emitido -> anulado, con motivo y fecha).
-- ============================================================
CREATE OR REPLACE FUNCTION certificados_proteger() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Los certificados emitidos no se pueden eliminar; anule el certificado.';
    END IF;

    IF NEW."codigo"              IS DISTINCT FROM OLD."codigo"
    OR NEW."tipo"                IS DISTINCT FROM OLD."tipo"
    OR NEW."idMascota"           IS DISTINCT FROM OLD."idMascota"
    OR NEW."idHistorial"         IS DISTINCT FROM OLD."idHistorial"
    OR NEW."idUsuario"           IS DISTINCT FROM OLD."idUsuario"
    OR NEW."fechaEmision"        IS DISTINCT FROM OLD."fechaEmision"
    OR NEW."vigenciaHasta"       IS DISTINCT FROM OLD."vigenciaHasta"
    OR NEW."contenido"           IS DISTINCT FROM OLD."contenido"
    OR NEW."mascota_nombre"      IS DISTINCT FROM OLD."mascota_nombre"
    OR NEW."mascota_especie"     IS DISTINCT FROM OLD."mascota_especie"
    OR NEW."mascota_raza"        IS DISTINCT FROM OLD."mascota_raza"
    OR NEW."dueno_nombre"        IS DISTINCT FROM OLD."dueno_nombre"
    OR NEW."nombre_veterinario"  IS DISTINCT FROM OLD."nombre_veterinario"
    OR NEW."tarjeta_profesional" IS DISTINCT FROM OLD."tarjeta_profesional"
    OR NEW."firma_veterinario"   IS DISTINCT FROM OLD."firma_veterinario"
    OR NEW."lote"                IS DISTINCT FROM OLD."lote"
    OR NEW."codigo_verificacion" IS DISTINCT FROM OLD."codigo_verificacion"
    OR NEW."huella"              IS DISTINCT FROM OLD."huella" THEN
        RAISE EXCEPTION 'Un certificado emitido no se puede modificar; solo anular.';
    END IF;

    IF OLD."estado" = 'anulado' AND NEW."estado" IS DISTINCT FROM 'anulado' THEN
        RAISE EXCEPTION 'Un certificado anulado no se puede reactivar.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_certificados_proteger ON certificados;
CREATE TRIGGER trg_certificados_proteger
    BEFORE UPDATE OR DELETE ON certificados
    FOR EACH ROW EXECUTE PROCEDURE certificados_proteger();


-- ============================================================
-- 7. DATOS INICIALES
-- ============================================================
INSERT INTO franjas_horarias ("nombre","hora_inicio","hora_fin","cupo_maximo","estado") VALUES
    ('Mañana','08:00','12:00',6,'activo'),
    ('Tarde', '14:00','18:00',6,'activo')
ON CONFLICT ("nombre") DO NOTHING;


-- ============================================================
-- 7. P10 (Dia 10): autorizaciones de adultos mayores
-- ============================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "fechaNacimiento" DATE;

CREATE TABLE IF NOT EXISTS consentimientos (
    "idConsentimiento" SERIAL PRIMARY KEY,
    "idUsuario"        INT NOT NULL REFERENCES usuarios("idUsuario") ON UPDATE CASCADE ON DELETE CASCADE,
    "idAcudiente"      INT NOT NULL REFERENCES acudientes("idAcudiente") ON UPDATE CASCADE,
    "version_texto"    VARCHAR(10) NOT NULL DEFAULT 'v1',
    "fechaAceptacion"  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRevocacion"  TIMESTAMP,
    "vigente"          BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consentimiento_vigente
    ON consentimientos("idUsuario") WHERE "vigente";
CREATE INDEX IF NOT EXISTS idx_consentimientos_usuario ON consentimientos("idUsuario");

-- ============================================================
-- 8. DIA 12: contacto directo en alertas graves (rojo)
-- ============================================================
ALTER TABLE alertas_seguimiento ADD COLUMN IF NOT EXISTS "fecha_contacto" TIMESTAMP;
ALTER TABLE alertas_seguimiento ADD COLUMN IF NOT EXISTS "contactado_por" INT REFERENCES usuarios("idUsuario") ON UPDATE CASCADE;
ALTER TABLE alertas_seguimiento ADD COLUMN IF NOT EXISTS "canal_contacto" VARCHAR(20);
ALTER TABLE alertas_seguimiento ADD COLUMN IF NOT EXISTS "nota_contacto"  TEXT;

CREATE INDEX IF NOT EXISTS idx_alertas_contacto_pendiente
    ON alertas_seguimiento("fecha_generada") WHERE "fecha_contacto" IS NULL AND "nivel" = 'rojo';

-- ============================================================
-- 9. FOTO DE LA MASCOTA (nombre del archivo JPEG guardado en uploads/mascotas)
-- ============================================================
ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS "foto" VARCHAR(64);

COMMIT;
