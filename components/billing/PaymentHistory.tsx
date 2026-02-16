'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Invoice {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  gateway: string;
}

interface PaymentHistoryProps {
  storeId: string;
}

export default function PaymentHistory({ storeId }: PaymentHistoryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await fetch(`/api/billing/invoices?storeId=${storeId}`);
        if (response.ok) {
          const data = await response.json();
          setInvoices(data);
        }
      } catch (error) {
        console.error('Error fetching invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [storeId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return <Badge className="bg-green-500">Succeeded</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-500">Failed</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div>Loading payment history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No payment history found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {new Date(invoice.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.currency === 'INR' ? '₹' : '$'}
                    {invoice.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{invoice.currency}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="capitalize">{invoice.gateway}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
