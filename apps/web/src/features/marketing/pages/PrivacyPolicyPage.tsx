import { Link } from "react-router-dom";
import { Logo } from "../../../components/ui/Logo";

// Datos del responsable del tratamiento (Ley 1581 de 2012, art. 17 y Decreto 1377 de 2013).
const RESPONSIBLE = {
  name: "Alexander Barrios",
  id: "cédula de ciudadanía 100129278",
  city: "Pereira, Colombia",
  email: "contaprocontabilidad@gmail.com",
  whatsapp: "300 845 3690",
};
const LAST_UPDATED = "17 de octubre de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

/**
 * Politica de tratamiento de datos personales y de cookies del sitio publico y del servicio.
 * Ruta publica /privacidad, enlazada desde el pie de la landing y desde el registro.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/register" className="text-sm font-medium text-brand-700 hover:underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Política de privacidad y tratamiento de datos personales</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {LAST_UPDATED}</p>

        <Section title="1. Quién es responsable de tus datos">
          <p>
            El responsable del tratamiento de los datos personales recogidos en contapro.com.co y en el servicio
            Contapro es <strong>{RESPONSIBLE.name}</strong>, identificado con {RESPONSIBLE.id}, con domicilio en{" "}
            {RESPONSIBLE.city}.
          </p>
          <p>
            Contacto para temas de datos personales: <strong>{RESPONSIBLE.email}</strong> o WhatsApp{" "}
            <strong>{RESPONSIBLE.whatsapp}</strong>.
          </p>
          <p>
            Esta política se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de
            2015) y las demás normas colombianas sobre protección de datos personales.
          </p>
        </Section>

        <Section title="2. Qué datos recogemos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Al crear una cuenta:</strong> nombre del negocio, NIT o cédula, nombre de la persona que se registra,
              correo electrónico y contraseña (la contraseña se guarda cifrada y nadie puede verla).
            </li>
            <li>
              <strong>Al usar el sistema:</strong> la información que cada empresa registra en Contapro, como productos,
              ventas, compras, clientes, proveedores, empleados, nómina y contabilidad.
            </li>
            <li>
              <strong>Al pagar la suscripción:</strong> datos de facturación. Los datos de la tarjeta o cuenta los recibe
              directamente la pasarela de pagos; Contapro no los guarda.
            </li>
            <li>
              <strong>Al visitar el sitio:</strong> datos de navegación como páginas vistas, tipo de dispositivo, ciudad
              aproximada y cómo llegaste al sitio, mediante cookies (ver punto 6).
            </li>
            <li>
              <strong>Al escribirnos:</strong> tu nombre, número de WhatsApp o correo y el contenido de la conversación.
            </li>
          </ul>
        </Section>

        <Section title="3. Para qué usamos tus datos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Crear y administrar tu cuenta y prestarte el servicio contratado.</li>
            <li>Procesar los pagos de la suscripción y emitir las facturas correspondientes.</li>
            <li>Generar y enviar facturas electrónicas y demás documentos ante la DIAN, cuando la empresa lo active.</li>
            <li>Darte soporte y responder tus preguntas.</li>
            <li>Enviarte avisos sobre tu cuenta, cambios en el servicio o en esta política.</li>
            <li>
              Medir el uso del sitio público y la efectividad de nuestra publicidad, para mejorar el sitio y mostrar
              anuncios a personas con intereses similares.
            </li>
            <li>Cumplir obligaciones legales, contables y tributarias.</li>
          </ul>
          <p>No vendemos tus datos personales a terceros.</p>
        </Section>

        <Section title="4. Datos que tu empresa registra en Contapro">
          <p>
            Cuando tu empresa registra datos de sus propios clientes, proveedores o empleados, tu empresa es la
            responsable de esos datos y Contapro actúa como <strong>encargado del tratamiento</strong>: los guarda y los
            procesa únicamente para prestar el servicio y siguiendo las instrucciones de tu empresa. Es tu empresa quien
            debe contar con la autorización de esas personas.
          </p>
          <p>
            La información contable y financiera de tu empresa no se usa para publicidad y no se comparte con
            herramientas de medición o redes sociales.
          </p>
        </Section>

        <Section title="5. Con quién compartimos datos">
          <p>Solo con los proveedores necesarios para prestar el servicio, y únicamente lo que cada uno necesita:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Proveedores de servidores y bases de datos en la nube, donde se aloja el sistema.</li>
            <li>El proveedor tecnológico de facturación electrónica y la DIAN, para emitir documentos electrónicos.</li>
            <li>La pasarela de pagos, para cobrar la suscripción.</li>
            <li>Servicios de envío de correos y de WhatsApp, para enviarte avisos o documentos.</li>
            <li>
              Servicios de inteligencia artificial, solo cuando decides usar funciones como la lectura de facturas o
              extractos con foto; se envía únicamente el documento que subes.
            </li>
            <li>Autoridades, cuando una norma o una orden judicial lo exija.</li>
          </ul>
          <p>
            Algunos de estos proveedores tienen servidores fuera de Colombia. Al aceptar esta política autorizas esa
            transferencia, que se hace con proveedores que ofrecen niveles adecuados de protección de datos.
          </p>
        </Section>

        <Section title="6. Cookies y herramientas de medición">
          <p>Usamos:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Google Analytics</strong> (a través de Google Tag Manager), en todo el sitio, para saber cuántas
              personas lo visitan, qué páginas y secciones usan, desde qué tipo de dispositivo, y cuántas nos escriben o se
              registran.
            </li>
            <li>
              <strong>Píxel de Meta</strong> (Facebook e Instagram), solo en las páginas públicas (inicio y registro),
              para medir los resultados de nuestros anuncios y mostrarlos a personas con intereses similares.
            </li>
          </ul>
          <p>
            Estas herramientas no reciben el contenido que registras dentro del sistema, como ventas, montos, clientes o
            datos contables. Puedes bloquear o borrar las
            cookies desde la configuración de tu navegador; el sitio seguirá funcionando. También puedes administrar los
            anuncios que ves en la configuración de anuncios de Google y de Meta.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>Como titular de los datos tienes derecho a:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Conocer, actualizar y rectificar tus datos personales.</li>
            <li>Pedir prueba de la autorización que nos diste.</li>
            <li>Ser informado sobre el uso que le damos a tus datos.</li>
            <li>
              Revocar la autorización o pedir que borremos tus datos, cuando no exista un deber legal o contractual de
              conservarlos (por ejemplo, documentos contables y tributarios que la ley obliga a guardar).
            </li>
            <li>Acceder gratis a tus datos personales.</li>
            <li>
              Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber hecho tu consulta o
              reclamo ante nosotros.
            </li>
          </ul>
        </Section>

        <Section title="8. Cómo hacer una consulta o un reclamo">
          <p>
            Escríbenos a <strong>{RESPONSIBLE.email}</strong> indicando tu nombre, tu documento de identidad, lo que
            necesitas y cómo te contactamos.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Consultas</strong> (saber qué datos tenemos y cómo los usamos): respondemos en un máximo de 10 días
              hábiles, prorrogables por 5 días hábiles más avisándote el motivo.
            </li>
            <li>
              <strong>Reclamos</strong> (corregir, actualizar, borrar datos o revocar la autorización): respondemos en un
              máximo de 15 días hábiles, prorrogables por 8 días hábiles más avisándote el motivo. Si el reclamo está
              incompleto, te pediremos completarlo dentro de los 5 días siguientes.
            </li>
          </ul>
        </Section>

        <Section title="9. Seguridad y conservación">
          <p>
            Usamos conexiones cifradas, contraseñas cifradas, cifrado de credenciales sensibles y control de acceso por
            usuario y por rol. Conservamos los datos mientras tu cuenta esté activa y después durante el tiempo que exijan
            las normas contables, tributarias y comerciales.
          </p>
        </Section>

        <Section title="10. Menores de edad">
          <p>Contapro es un servicio para negocios y no está dirigido a menores de edad.</p>
        </Section>

        <Section title="11. Cambios a esta política">
          <p>
            Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha de actualización y, si el
            cambio es importante, te avisaremos por correo o dentro del sistema.
          </p>
        </Section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <Link to="/" className="hover:underline">
          Volver al inicio
        </Link>
      </footer>
    </div>
  );
}
