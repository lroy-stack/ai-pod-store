'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Customer {
  email: string;
  name: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
}

interface CustomerProfile {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar_url: string | null;
    locale: string;
    currency: string;
    phone: string | null;
    email_verified: boolean;
    created_at: string;
    last_login_at: string | null;
  };
  stats: {
    orderCount: number;
    totalSpent: number;
    currency: string;
    conversationCount: number;
    wishlistCount: number;
    reviewCount: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(
          (c) =>
            c.email.toLowerCase().includes(query) ||
            c.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, customers]);

  const fetchCustomers = async () => {
    try {
      const response = await adminFetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        setFilteredCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    try {
      // Fetch both profile and orders in parallel
      const [profileResponse, ordersResponse] = await Promise.all([
        adminFetch(`/api/customers/${encodeURIComponent(customer.email)}/profile`),
        adminFetch(`/api/customers/${encodeURIComponent(customer.email)}/orders`),
      ]);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setCustomerProfile(profileData);
      }

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setCustomerOrders(ordersData);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      paid: 'default',
      processing: 'default',
      shipped: 'default',
      delivered: 'default',
      cancelled: 'destructive',
      refunded: 'outline',
    };
    return variants[status] || 'secondary';
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">View and manage customer information</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading customers...</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No customers found</p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Total Spent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow
                          key={customer.email}
                          onClick={() => handleCustomerClick(customer)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.email}</TableCell>
                          <TableCell>{customer.orderCount}</TableCell>
                          <TableCell>
                            {formatCurrency(customer.totalSpent, customer.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden space-y-4">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.email}
                      onClick={() => handleCustomerClick(customer)}
                      className="w-full text-left border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors min-h-[88px]"
                    >
                      <div>
                        <h3 className="font-medium text-base leading-tight mb-1">
                          {customer.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {customer.email}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">
                          {customer.orderCount} {customer.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(customer.totalSpent, customer.currency)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.name} - Customer Details
            </DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <p className="text-center py-8 text-muted-foreground">Loading customer details...</p>
          ) : customerProfile ? (
            <div className="space-y-6">
              {/* Profile Information */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{customerProfile.profile.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{customerProfile.profile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{customerProfile.profile.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <Badge variant="outline">{customerProfile.profile.role}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Locale</p>
                    <p className="font-medium">{customerProfile.profile.locale.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email Verified</p>
                    <Badge variant={customerProfile.profile.email_verified ? 'default' : 'secondary'}>
                      {customerProfile.profile.email_verified ? 'Verified' : 'Not Verified'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">{formatDate(customerProfile.profile.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Login</p>
                    <p className="font-medium">
                      {customerProfile.profile.last_login_at
                        ? formatDate(customerProfile.profile.last_login_at)
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Customer Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(customerProfile.stats.totalSpent, customerProfile.stats.currency)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Orders</p>
                      <p className="text-2xl font-bold">{customerProfile.stats.orderCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Conversations</p>
                      <p className="text-2xl font-bold">{customerProfile.stats.conversationCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Wishlists</p>
                      <p className="text-2xl font-bold">{customerProfile.stats.wishlistCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Reviews</p>
                      <p className="text-2xl font-bold">{customerProfile.stats.reviewCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Avg. Order</p>
                      <p className="text-2xl font-bold">
                        {customerProfile.stats.orderCount > 0
                          ? formatCurrency(
                              customerProfile.stats.totalSpent / customerProfile.stats.orderCount,
                              customerProfile.stats.currency
                            )
                          : formatCurrency(0, customerProfile.stats.currency)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Order History */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Order History</h3>
                {customerOrders.length === 0 ? (
                  <p className="text-muted-foreground py-4">No orders found</p>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">
                              {order.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(order.total, order.currency)}
                            </TableCell>
                            <TableCell>{formatDate(order.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No customer details available</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
