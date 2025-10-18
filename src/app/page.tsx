
import { kv } from '@vercel/kv';
import InvoiceForm from '@/components/InvoiceForm';
import { Invoice } from './api/generate-invoice/route'; // Import the Invoice type

// --- Server-side function to fetch invoices from KV ---
async function getInvoices(): Promise<Invoice[]> {
  try {
    const keys = await kv.keys('invoice:*');
    if (keys.length === 0) return [];

    const invoices = await kv.mget<Invoice[]>(...keys);
    
    // Sort invoices by ID descending (newest first)
    return invoices.filter(inv => inv !== null).sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error("Failed to read invoices from KV:", error);
    return []; // Return empty array on error
  }
}

// --- Main Page Component (Server Component) ---
export default async function HomePage() {
  const invoices = await getInvoices();

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-6xl">
        {/* The form is a Client Component */}
        <InvoiceForm />

        {/* The table of past invoices is rendered on the server */}
        <div className="mt-12 bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">Facturas Emitidas</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b font-medium bg-gray-100">
                        <tr>
                            <th scope="col" className="px-6 py-4">Nº Factura</th>
                            <th scope="col" className="px-6 py-4">Inquilino</th>
                            <th scope="col" className="px-6 py-4">Fecha</th>
                            <th scope="col" className="px-6 py-4 text-right">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.map((invoice) => (
                            <tr key={invoice.id} className="border-b hover:bg-gray-50">
                                <td className="whitespace-nowrap px-6 py-4 font-medium">{invoice.number}</td>
                                <td className="whitespace-nowrap px-6 py-4">{invoice.tenant.name}</td>
                                <td className="whitespace-nowrap px-6 py-4">{invoice.invoiceDate}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-right font-mono">{invoice.total.toFixed(2)} €</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {invoices.length === 0 && <p className="text-center text-gray-500 mt-6">No hay facturas para mostrar. Conecta la base de datos y genera una.</p>}
        </div>
      </div>
    </main>
  );
}
