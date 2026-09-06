import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CreditCard, LockKeyhole, Plus, Send } from 'lucide-react';
import { EventTable } from '../components/Events';
import {
  Badge,
  Button,
  Card,
  Cell,
  Empty,
  ErrorBox,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Stat,
  Table,
} from '../components/ui';
import { api, date, money, queryClient, useData } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Account, Beneficiary, Page, SecurityEvent, Transaction } from '../types';

export default function Banking() {
  const { user, clear } = useAuth();
  const path = useLocation().pathname;
  const customer = user?.role === 'customer';
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const account = useData<Account>('/accounts/me', customer);
  const accounts = useData<Account[]>('/soc/customers', !customer);
  const beneficiaries = useData<Beneficiary[]>(customer ? '/beneficiaries' : '/soc/beneficiaries');
  const transactions = useData<Page<Transaction>>(
    `${customer ? '/transfers' : '/soc/transactions'}?page=${page}`,
  );
  const activity = useData<SecurityEvent[]>('/security/activity', customer);
  const showTransactions = path.endsWith('transactions');
  const showBeneficiaries = path.endsWith('beneficiaries');
  async function submit(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'beneficiary') await api('/beneficiaries', 'POST', values);
      else if (dialog === 'transfer')
        await api('/transfers', 'POST', { ...values, amount: Number(values.amount) });
      else {
        await api('/security/change-password', 'POST', values);
        clear();
      }
      setDialog('');
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="BANKGUARD BANK / SYNTHETIC RETAIL BANKING"
        title={
          showTransactions
            ? 'Transactions'
            : showBeneficiaries
              ? 'Beneficiaries'
              : customer
                ? `Welcome, ${user.name.split(' ')[0]}`
                : 'Banking accounts'
        }
        description={
          customer
            ? 'Your fictional banking workspace. All balances and transfers are simulated.'
            : 'Inspect the banking state protected by BankGuard. Changes reflect actual simulation outcomes.'
        }
        action={
          customer && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog('beneficiary')}>
                <Plus size={15} />
                Add beneficiary
              </Button>
              <Button onClick={() => setDialog('transfer')}>
                <Send size={15} />
                Transfer
              </Button>
            </div>
          )
        }
      />
      <ErrorBox
        error={account.error || accounts.error || transactions.error || beneficiaries.error}
      />
      {!showTransactions && !showBeneficiaries && (
        <>
          {customer ? (
            account.data ? (
              <>
                <div className="grid gap-5 md:grid-cols-3">
                  <Stat
                    label="Total balance"
                    value={money(account.data.balance)}
                    icon={<CreditCard size={18} />}
                    hint={account.data.number}
                  />
                  <Stat
                    label="Available balance"
                    value={money(account.data.available_balance || 0)}
                    hint="Excludes held and frozen funds"
                  />
                  <Card>
                    <LockKeyhole size={22} className="mb-4 text-brand" />
                    <p className="mb-3 text-sm text-muted">Security status</p>
                    <Badge value={account.data.status} />
                    <Button
                      className="mt-4 w-full"
                      variant="secondary"
                      onClick={() => setDialog('password')}
                    >
                      Change password
                    </Button>
                  </Card>
                </div>
                <h2 className="mb-4 mt-8 font-semibold">Recent transactions</h2>
              </>
            ) : (
              <Loading />
            )
          ) : accounts.data ? (
            <Table headings={['Customer', 'Account', 'Balance', 'Security state']}>
              {accounts.data.map((a) => (
                <tr key={a.id}>
                  <Cell>
                    {a.customer?.name}
                    <p className="mt-1 text-xs text-muted">{a.customer?.customer_id}</p>
                  </Cell>
                  <Cell mono>{a.number}</Cell>
                  <Cell>{money(a.balance)}</Cell>
                  <Cell>
                    <Badge value={a.status} />
                  </Cell>
                </tr>
              ))}
            </Table>
          ) : (
            <Loading />
          )}
        </>
      )}
      {(showTransactions || (customer && !showBeneficiaries)) &&
        (transactions.data ? (
          <>
            <Table headings={['Date', 'Reference', 'Amount', 'Status']}>
              {transactions.data.items.map((t) => (
                <tr key={t.id}>
                  <Cell mono>{date(t.created_at)}</Cell>
                  <Cell>{t.reference}</Cell>
                  <Cell>{money(t.amount)}</Cell>
                  <Cell>
                    <Badge value={t.status} />
                  </Cell>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={transactions.data.total} setPage={setPage} />
          </>
        ) : (
          <Loading />
        ))}
      {showBeneficiaries && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {beneficiaries.data?.map((b) => (
            <Card key={b.id}>
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
                {b.name[0]}
              </div>
              <h2 className="font-semibold">{b.name}</h2>
              <p className="mt-2 font-mono text-xs text-muted">{b.account_number}</p>
              <p className="mt-4 text-xs text-muted">Added {date(b.created_at)}</p>
            </Card>
          ))}
          {beneficiaries.data?.length === 0 && (
            <Empty text="No beneficiaries yet. Add a fictional payee to start a simulated transfer." />
          )}
        </div>
      )}
      {customer && !showTransactions && !showBeneficiaries && activity.data && (
        <section className="mt-8">
          <h2 className="mb-4 font-semibold">Security activity</h2>
          <EventTable events={activity.data} />
        </section>
      )}
      <Modal
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) setDialog('');
        }}
        title={
          dialog === 'transfer'
            ? 'Initiate a simulated transfer'
            : dialog === 'password'
              ? 'Change your password'
              : 'Add a fictional beneficiary'
        }
        description="This action affects only the synthetic BankGuard environment."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget);
          }}
          className="space-y-4"
        >
          {dialog === 'beneficiary' && (
            <>
              <label>
                Beneficiary name
                <input name="name" minLength={2} maxLength={100} required />
              </label>
              <label>
                Fictional account number
                <input
                  name="account_number"
                  pattern="BG-[A-Z0-9\-]{3,32}"
                  placeholder="BG-DEMO-123"
                  required
                />
              </label>
            </>
          )}
          {dialog === 'transfer' && (
            <>
              <label>
                Beneficiary
                <select name="beneficiary_id" required>
                  <option value="">Choose a beneficiary</option>
                  {beneficiaries.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount (INR)
                <input type="number" name="amount" min="0.01" max="1000000" step="0.01" required />
              </label>
              <label>
                Reference
                <input name="reference" maxLength={120} required />
              </label>
            </>
          )}
          {dialog === 'password' && (
            <>
              <label>
                Current password
                <input
                  type="password"
                  name="current_password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password (12+ characters)
                <input
                  type="password"
                  name="new_password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <p className="text-xs text-muted">
                All your sessions will be revoked. Sign in again with your new password.
              </p>
            </>
          )}
          <ErrorBox error={error} />
          <Button disabled={busy}>{busy ? 'Processing…' : 'Confirm'}</Button>
        </form>
      </Modal>
    </>
  );
}
