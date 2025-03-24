import React, { useState, useEffect } from 'react';
import { Route, Routes, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import BudgetStatusPage from './components/BudgetStatusPage';
import Budgets from './components/Budgets';
import Customers from './components/Customers';
import Products from './components/Products';
import Accessories from './components/Accessories';
import Reports from './components/Reports';
import Login from './components/Login';
import Configuracoes from './components/Configuracoes';
import BudgetList from './components/BudgetList';
import BudgetDetailsPage from './components/BudgetDetailsPage';
import HomePage from './components/HomePage';
import Dashboard from './components/Dashboard';
import { supabase } from './supabase/client';
import TestDB from './components/TestDB';
import { authService } from './services/authService';
import { syncService } from './services/syncService';
import { localDB } from './services/localDatabase';
import VisitScheduler from './components/VisitScheduler';
import ConnectionStatus from './components/ConnectionStatus';
import './components/ConnectionStatus.css';

function App() {
  const [companyLogo, setCompanyLogo] = useState(null);
  const [validadeOrcamento, setValidadeOrcamento] = useState('30');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(authService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    loadFromCache();
    syncData();
    fetchVisits();
    
    const syncInterval = setInterval(syncData, 30 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        const { data, error } = await supabase.from('orcamentos').select('*');
        if (error) throw error;
        
        // Check and update any 'pending' status to 'pendente'
        const needsUpdate = data.filter(budget => budget.status === 'pending');
        if (needsUpdate.length > 0) {
          console.log('Updating old pending statuses:', needsUpdate.length);
          for (const budget of needsUpdate) {
            await supabase
              .from('orcamentos')
              .update({ status: 'pendente' })
              .eq('id', budget.id);
            
            // Update local storage as well
            localDB.update('orcamentos', budget.id, { status: 'pendente' });
          }
          // Fetch again after updates
          const { data: updatedData, error: updatedError } = await supabase.from('orcamentos').select('*');
          if (updatedError) throw updatedError;
          setBudgets(updatedData);
        } else {
          setBudgets(data);
        }
      } catch (error) {
        console.error('Error fetching budgets:', error);
      }
    };

    fetchBudgets();
  }, []);

  const loadFromCache = async () => {
    try {
      setLoading(true);
      const [
        localBudgets,
        localCustomers,
        localProducts,
        localAccessories,
        localConfig
      ] = await Promise.all([
        localDB.getAll('orcamentos'),
        localDB.getAll('clientes'),
        localDB.getAll('produtos'),
        localDB.getAll('accessories'),
        localDB.get('configuracoes', 1)
      ]);

      if (localBudgets?.length) setBudgets(localBudgets);
      if (localCustomers?.length) setCustomers(localCustomers);
      if (localProducts?.length) setProducts(localProducts);
      if (localAccessories?.length) setAccessories(localAccessories);
      if (localConfig?.company_logo) setCompanyLogo(localConfig.company_logo);
    } catch (error) {
      console.error('Error loading from cache:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    if (syncing) return; 
    try {
      setSyncing(true);
      await syncService.syncAll();
      
      const [
        updatedBudgets,
        updatedCustomers,
        updatedProducts,
        updatedAccessories,
        updatedConfig
      ] = await Promise.all([
        localDB.getAll('orcamentos'),
        localDB.getAll('clientes'),
        localDB.getAll('produtos'),
        localDB.getAll('accessories'),
        localDB.get('configuracoes', 1)
      ]);

      setBudgets(updatedBudgets);
      setCustomers(updatedCustomers);
      setProducts(updatedProducts);
      setAccessories(updatedAccessories);
      if (updatedConfig?.company_logo) setCompanyLogo(updatedConfig.company_logo);
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchVisits = async () => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .order('date_time', { ascending: true });

      if (error) {
        console.error('Error fetching visits:', error);
        return;
      }

      setVisits(data || []);
    } catch (error) {
      console.error('Error in fetchVisits:', error);
    }
  };

  const handleLogin = (user) => {
    console.log('Login successful:', user);
    setLoggedInUser(user);
    navigate("/");
  };

  const handleLogout = () => {
    authService.logout();
    setLoggedInUser(null);
    navigate("/login");
  };

  const handleFinalizeBudget = async (budgetId) => {
    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({ status: 'finalizado' })
        .eq('id', budgetId);

      if (error) throw error;

      const updatedBudgets = budgets.map(budget =>
        budget.id === budgetId ? { ...budget, status: 'finalizado' } : budget
      );
      setBudgets(updatedBudgets);

      localDB.update('orcamentos', budgetId, { status: 'finalizado' });
    } catch (error) {
      console.error('Error finalizing budget:', error);
    }
  };

  const handleCancelBudget = async (budgetId) => {
    try {
      // First check if the budget exists and is in a cancellable state
      const { data: budget, error: fetchError } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', budgetId)
        .single();

      if (fetchError) throw fetchError;

      if (!budget) {
        throw new Error('Orçamento não encontrado');
      }

      if (budget.status !== 'pending') {
        throw new Error('Apenas orçamentos pendentes podem ser cancelados');
      }

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({ status: 'cancelado' })
        .eq('id', budgetId);

      if (updateError) throw updateError;

      // Update local state
      const updatedBudgets = budgets.map(budget =>
        budget.id === budgetId ? { ...budget, status: 'cancelado' } : budget
      );
      setBudgets(updatedBudgets);

      // Update local database
      const updatedBudget = { ...budget, status: 'cancelado' };
      await localDB.put('orcamentos', updatedBudget);

      // Show success message
      alert('Orçamento cancelado com sucesso');
    } catch (error) {
      console.error('Error canceling budget:', error);
      alert(error.message || 'Erro ao cancelar orçamento');
    }
  };

  const handleReactivateBudget = async (budgetId) => {
    try {
      // First check if the budget exists and is canceled
      const { data: budget, error: fetchError } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', budgetId)
        .single();

      if (fetchError) throw fetchError;

      if (!budget) {
        throw new Error('Orçamento não encontrado');
      }

      if (budget.status !== 'cancelado') {
        throw new Error('Apenas orçamentos cancelados podem ser reativados');
      }

      // Update in Supabase
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({ status: 'pending' })
        .eq('id', budgetId);

      if (updateError) throw updateError;

      // Update local state
      const updatedBudgets = budgets.map(budget =>
        budget.id === budgetId ? { ...budget, status: 'pending' } : budget
      );
      setBudgets(updatedBudgets);

      // Update local database
      const updatedBudget = { ...budget, status: 'pending' };
      await localDB.put('orcamentos', updatedBudget);

      // Show success message
      alert('Orçamento reativado com sucesso');
    } catch (error) {
      console.error('Error reactivating budget:', error);
      alert(error.message || 'Erro ao reativar orçamento');
    }
  };

  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">Carregando...</div>
      </div>
    );
  }

  // If no user is logged in, show only the login page
  if (!loggedInUser) {
    return (
      <div className="app">
        <div className="login-page-container">
          <Login onLogin={handleLogin} companyLogo={companyLogo} />
        </div>
        <footer className="app-footer">
          <p>© 2025 Vecchio Sistemas</p>
        </footer>
      </div>
    );
  }

  // If user is logged in, show the main application
  return (
    <div className="app">
      <button 
        className="menu-toggle" 
        onClick={toggleSidebar}
        aria-label="Toggle Menu"
      >
        {sidebarExpanded ? '✕' : '☰'}
      </button>
      
      {companyLogo && (
        <img 
          src={companyLogo} 
          alt="Logo da Empresa" 
          className="company-logo"
        />
      )}

      <div className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
        <nav>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/" className="nav-link">
                <span className="icon">🏠</span>
                <span className="text">Home</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/customers" className="nav-link">
                <span className="icon">👥</span>
                <span className="text">Clientes</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/products" className="nav-link">
                <span className="icon">📦</span>
                <span className="text">Produtos</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/accessories" className="nav-link">
                <span className="icon">🔧</span>
                <span className="text">Acessórios</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/budgets" className="nav-link">
                <span className="icon">📝</span>
                <span className="text">Orçamentos</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/reports" className="nav-link">
                <span className="icon">📊</span>
                <span className="text">Relatórios</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/visits" className="nav-link">
                <span className="icon">📅</span>
                <span className="text">Visitas</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/configuracoes" className="nav-link">
                <span className="icon">⚙️</span>
                <span className="text">Configurações</span>
              </NavLink>
            </li>
            <li className="nav-item">
              <button onClick={handleLogout} className="nav-link logout-button">
                <span className="icon">🚪</span>
                <span className="text">Sair</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <main className={`main-content ${sidebarExpanded ? 'expanded' : ''}`}>
        <Routes>
          <Route 
            path="/" 
            element={<HomePage 
              budgets={budgets} 
              customers={customers} 
              visits={visits} 
              setVisits={setVisits}
            />}
          />
          <Route 
            path="/customers" 
            element={
              authService.hasAccess('admin') ? (
                <Customers 
                  customers={customers} 
                  setCustomers={setCustomers}
                />
              ) : (
                <div>Acesso restrito</div>
              )
            }
          />
          <Route 
            path="/products" 
            element={<Products products={products} setProducts={setProducts} />}
          />
          <Route 
            path="/accessories" 
            element={<Accessories accessories={accessories} setAccessories={setAccessories} />}
          />
          <Route 
            path="/budgets" 
            element={<BudgetStatusPage budgets={budgets} setBudgets={setBudgets} validadeOrcamento={validadeOrcamento} />}
          />
          <Route 
            path="/budgets/new" 
            element={<Budgets 
              budgets={budgets} 
              setBudgets={setBudgets} 
              customers={customers} 
              products={products} 
              accessories={accessories} 
              setCustomers={setCustomers} 
            />}
          />
          <Route 
            path="/budgets/:budgetId/edit" 
            element={<Budgets 
              budgets={budgets} 
              setBudgets={setBudgets} 
              customers={customers} 
              products={products} 
              accessories={accessories} 
              setCustomers={setCustomers} 
            />}
          />
          <Route 
            path="/budgets/:budgetId/view" 
            element={<BudgetDetailsPage companyLogo={companyLogo} />}
          />
          <Route 
            path="/reports" 
            element={<Reports budgets={budgets} customers={customers} />}
          />
          <Route 
            path="/visits" 
            element={<VisitScheduler visits={visits} setVisits={setVisits} />}
          />
          <Route 
            path="/configuracoes" 
            element={
              authService.hasAccess('admin') ? (
                <Configuracoes 
                  setCompanyLogo={setCompanyLogo} 
                  companyLogo={companyLogo} 
                  validadeOrcamento={validadeOrcamento} 
                  setValidadeOrcamento={setValidadeOrcamento} 
                />
              ) : (
                <div>Acesso restrito</div>
              )
            }
          />
          <Route 
            path="/test" 
            element={<TestDB />}
          />
        </Routes>
      </main>
      
      <footer className="app-footer">
        <div>© 2025 Vecchio Sistemas <ConnectionStatus /></div>
      </footer>
    </div>
  );
}

export default App;
