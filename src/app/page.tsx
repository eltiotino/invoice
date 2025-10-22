
import InvoiceForm from '@/components/InvoiceForm';

// --- Main Page Component (Server Component) ---
export default function HomePage() {
  // The invoice list functionality has been removed since KV is not configured
  // Only the form is displayed

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-6xl">
        {/* The form is a Client Component */}
        <InvoiceForm />

        {/* Invoice history section has been removed for now */}
        <div className="mt-12 bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Facturas Emitidas</h2>
          <p className="text-gray-600">La funcionalidad de historial de facturas está deshabilitada en esta versión.</p>
          <p className="text-gray-600 mt-2">Las facturas se generan directamente como archivos PDF.</p>
        </div>
      </div>
    </main>
  );
}
