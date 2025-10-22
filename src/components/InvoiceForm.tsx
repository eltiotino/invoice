'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import tenants from '@/data/tenants.json'; // Importamos los inquilinos

interface Item {
  description: string;
  quantity: number;
  price: number;
}

interface Tenant {
  name: string;
  dni: string;
  address: string;
}

export default function InvoiceForm() {
  const router = useRouter();
  
  // --- ESTADO DEL INQUILINO MODIFICADO ---
  // Ahora tenemos un único estado para el inquilino seleccionado
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(tenants[0] || null);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('25/10'); // Valor predeterminado en formato AA/MM
  const [items, setItems] = useState<Item[]>([{ description: 'Alquiler de local comercial\\nAgosto de 2025\\nDireccion del Local: Calle Ribadavia 31 Local 7 29029 Madrid', quantity: 1, price: 0 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTenantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDni = event.target.value;
    const tenant = tenants.find(t => t.dni === selectedDni) || null;
    setSelectedTenant(tenant);
  };

  const handleAddItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleItemChange = (index: number, field: keyof Item, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    if (typeof item[field] === 'number') {
      newItems[index] = { ...item, [field]: parseFloat(value as string) || 0 };
    } else {
      newItems[index] = { ...item, [field]: value };
    }
    setItems(newItems);
  };

  const { subtotal, iva, irpf, total } = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const iva = subtotal * 0.21;
    const irpf = subtotal * 0.19;
    const total = subtotal + iva - irpf;
    return { subtotal, iva, irpf, total };
  }, [items]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTenant) {
        setError('Por favor, selecciona un inquilino.');
        return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            tenant: selectedTenant, // Usamos el inquilino seleccionado
            invoiceDate: new Date(invoiceDate).toLocaleDateString('es-ES'),
            invoiceNumber: invoiceNumber, // Número de factura en formato AA/MM
            items 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'factura.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/i);
        if (match) filename = match[1];
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      // Ya no refrescamos la página porque no hay tabla que actualizar
      // router.refresh(); 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-white p-8 rounded-lg shadow-md mb-12">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Generador de Facturas</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Datos del Inquilino</h2>
            {/* --- CAMPOS DE INQUILINO REEMPLAZADOS POR UN MENÚ DESPLEGABLE --*/}
            <select 
              value={selectedTenant?.dni || ''} 
              onChange={handleTenantChange} 
              required 
              className="w-full p-3 border rounded-md bg-white"
            >
              <option value="" disabled>Selecciona un inquilino</option>
              {tenants.map(tenant => (
                <option key={tenant.dni} value={tenant.dni}>{tenant.name}</option>
              ))}
            </select>
            {selectedTenant && (
                <div className="mt-4 p-3 bg-gray-50 border rounded-md text-sm text-gray-600">
                    <p><strong>DNI:</strong> {selectedTenant.dni}</p>
                    <p><strong>Dirección:</strong> {selectedTenant.address}</p>
                </div>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Fecha de Factura</h2>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required className="w-full p-3 border rounded-md" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Número de Factura</h2>
              <input 
                type="text" 
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)} 
                required 
                placeholder="Ej: 25/10"
                className="w-full p-3 border rounded-md" 
              />
              <p className="text-sm text-gray-500 mt-1">Formato: AA/MM (ej: 25/07 para 2025, mes 7)</p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4 text-gray-700">Conceptos</h2>
        <div className="space-y-3 mb-4">
          {items.map((item, index) => (
            <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-2 p-2 bg-gray-50 rounded-md border">
              <input type="text" placeholder="Descripción" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="flex-grow p-2 border rounded-md min-w-[200px]" />
              <input type="number" placeholder="Cant." value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-20 p-2 border rounded-md" />
              <input type="number" step="0.01" placeholder="Precio" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} className="w-24 p-2 border rounded-md" />
              <p className="w-28 p-2 font-mono text-right">{(item.quantity * item.price).toFixed(2)} €</p>
              <button type="button" onClick={() => handleRemoveItem(index)} className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">-</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={handleAddItem} className="mb-6 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">+ Añadir Concepto</button>

        <div className="flex justify-end mb-6">
            <div className="w-full max-w-sm space-y-2 text-right">
                <div className="flex justify-between"><span className="font-medium">Base Imponible:</span><span className="font-mono">{subtotal.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="font-medium">IVA (21%):</span><span className="font-mono">{iva.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="font-medium">Retención IRPF (19%):</span><span className="font-mono text-red-500">-{irpf.toFixed(2)} €</span></div>
                <hr className="my-2"/>
                <div className="flex justify-between text-lg font-bold"><span className="">TOTAL:</span><span className="font-mono">{total.toFixed(2)} €</span></div>
            </div>
        </div>

        <div className="flex justify-end border-t pt-6">
          <button type="submit" disabled={isLoading} className="px-8 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-gray-400">
            {isLoading ? 'Generando...' : 'Generar Factura'}
          </button>
        </div>
        {error && <p className="text-red-500 mt-4 text-right">{error}</p>}
      </form>
    </div>
  );
}