import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import './BudgetDetailsPage.css';
import { supabase } from '../supabase/client';

function BudgetDetailsPage({ companyLogo }) {
  const { budgetId } = useParams();
  const navigate = useNavigate();
  const [budget, setBudget] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessories, setAccessories] = useState([]);
  const [companyData, setCompanyData] = useState(null);
  const contentRef = useRef(null);

  console.log('BudgetDetailsPage rendered with budgetId:', budgetId);

  // O carregamento inicial dos dados do orçamento
  useEffect(() => {
    if (!budgetId) {
      console.error('No budgetId provided');
      setError('Orçamento não encontrado. ID não fornecido.');
      setLoading(false);
      return;
    }

    console.log('Loading budget details for ID:', budgetId);
    const loadBudgetDetails = async () => {
      try {
        console.log('Loading budget details for ID:', budgetId);
        
        // Buscar o orçamento com join para informações do cliente
        const { data: budgetData, error: budgetError } = await supabase
          .from('orcamentos')
          .select(`
            *,
            clientes (
              id,
              name,
              email,
              phone,
              address
            )
          `)
          .eq('id', budgetId)
          .maybeSingle();

        if (budgetError) throw budgetError;
        
        if (!budgetData) {
          console.error('Orçamento não encontrado ou excluído da base de dados');
          setError('Orçamento não encontrado ou foi excluído da base de dados. Por favor, verifique na lista de orçamentos.');
          setLoading(false);
          return;
        }

        console.log('Budget data loaded:', budgetData);
        
        // Verificar se o cliente do orçamento existe
        if (!budgetData.clientes || !budgetData.clientes.id) {
          console.log('Cliente não encontrado no orçamento ou ID do cliente não informado');
          
          // Se o orçamento tem um cliente_id, mas o join não retornou dados do cliente,
          // buscar o cliente diretamente
          if (budgetData.cliente_id) {
            console.log('Tentando buscar o cliente ID:', budgetData.cliente_id);
            const { data: customerData, error: customerError } = await supabase
              .from('clientes')
              .select('*')
              .eq('id', budgetData.cliente_id)
              .maybeSingle();
              
            if (!customerError && customerData) {
              console.log('Cliente encontrado separadamente:', customerData);
              // Atualizar o orçamento com os dados do cliente
              budgetData.clientes = customerData;
            } else {
              console.error('Erro ao buscar cliente ou cliente não encontrado:', customerError);
            }
          }
        }
        
        // Carregar os acessórios
        const { data: accessoriesData, error: accessoriesError } = await supabase
          .from('accessories')
          .select('*');

        if (accessoriesError) throw accessoriesError;
        console.log('All accessories data:', accessoriesData);

        // Carregar os produtos
        const { data: productsData, error: productsError } = await supabase
          .from('produtos')
          .select('*');

        if (productsError) throw productsError;
        console.log('Products data loaded:', productsData);

        setBudget(budgetData);
        setProducts(productsData);
        setAccessories(accessoriesData);
      } catch (error) {
        console.error('Error loading budget details:', error);
        setError(`Erro ao carregar detalhes do orçamento: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const loadCompanyData = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*');
        
        if (error) throw error;
        
        // Use the first configuration item if multiple rows are returned
        if (data && data.length > 0) {
          setCompanyData(data[0]);
        } else {
          console.warn('No company configuration found');
        }
      } catch (error) {
        console.error('Error loading company data:', error);
      }
    };

    loadCompanyData();
    loadBudgetDetails();
  }, [budgetId]);

  // Configurar listener para mudanças nos clientes em um useEffect separado
  useEffect(() => {
    if (!budget || !budget.cliente_id) return;
    
    console.log('Configurando listener para cliente ID:', budget.cliente_id);
    
    const customersSubscription = supabase
      .channel('clientes_changes_details')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'clientes' 
        }, 
        (payload) => {
          console.log('Cliente modificado:', payload);
          
          // Verificar se a alteração afeta o cliente deste orçamento
          if (payload.new && payload.new.id === budget.cliente_id) {
            console.log('Atualizando cliente do orçamento atual');
            
            // Se foi uma atualização ou inserção, atualiza o cliente no orçamento
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              setBudget(prev => ({
                ...prev,
                clientes: payload.new
              }));
            } 
            // Se foi uma exclusão, limpa o cliente do orçamento
            else if (payload.eventType === 'DELETE') {
              setBudget(prev => ({
                ...prev,
                clientes: null
              }));
            }
          }
        }
      )
      .subscribe();
      
    return () => {
      customersSubscription.unsubscribe();
    };
  }, [budget?.cliente_id]); // Depende apenas do ID do cliente no orçamento

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getProductDetails = (productId) => {
    return products.find(p => p.id === productId) || {};
  };

  const formatProductDescription = (product, item) => {
    let description = [
      product.nome || 'Produto',
      product.modelo || '',
      product.tecido || '',
      product.codigo || ''
    ].filter(Boolean).join(' - ');

    if (item.bando) {
      description += ' COM BANDO';
    }

    if (item.instalacao) {
      description += ' INSTALADO';
    }

    return description;
  };

  // This function gets the name of an accessory by its ID
  const getAccessoryName = (accessoryId) => {
    if (!accessories || !accessoryId) return 'Acessório não encontrado (ID inválido)';
    
    // Convert IDs to strings for comparison (if they might be different types)
    const accessoryIdStr = String(accessoryId);
    console.log('Looking for accessory ID:', accessoryIdStr);
    console.log('Available accessories:', accessories);
    
    const accessory = accessories.find(a => String(a.id) === accessoryIdStr);
    if (!accessory) {
      console.log('Accessory not found by ID:', accessoryIdStr);
      // Retornar uma mensagem mais informativa incluindo o ID que não foi encontrado
      return `Acessório não encontrado (ID: ${accessoryIdStr}). Verifique se foi excluído.`;
    }
    
    return accessory.name || 'Acessório sem nome';
  };

  const calculateValidadeDate = (createdAt, validadeDias) => {
    return new Date(new Date(createdAt).getTime() + validadeDias * 24 * 60 * 60 * 1000).toLocaleDateString();
  };

  const handlePrintPDF = async () => {
    const doc = new jsPDF();
    const content = contentRef.current;
    
    if (!content) return;
    
    // Use html2canvas to capture the exact layout
    const canvas = await html2canvas(content, {
      scale: 2, // Higher quality
      useCORS: true, // Allow loading external images
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    // Add the captured image to PDF
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Calculate scaling to fit the page width while maintaining aspect ratio
    const scale = pdfWidth / imgWidth;
    const scaledHeight = imgHeight * scale;
    
    // Add multiple pages if content is too long
    let heightLeft = scaledHeight;
    let position = 0;
    
    // First page
    doc.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
    heightLeft -= pdfHeight;
    
    // Add new pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - scaledHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;
    }
    
    doc.save(`orcamento_${budgetId}.pdf`);
  };

  const renderCustomerInfo = () => {
    if (!budget || !budget.clientes) {
      return (
        <div className="customer-info">
          <h3>Cliente</h3>
          <p>Cliente não encontrado ou foi removido</p>
        </div>
      );
    }
    
    return (
      <div className="customer-info">
        <h3>Cliente</h3>
        <p>Nome: {budget.clientes.name}</p>
        <p>Endereço: {budget.clientes.address || 'Não informado'}</p>
        <p>Telefone: {budget.clientes.phone || 'Não informado'}</p>
        <p>Email: {budget.clientes.email || 'Não informado'}</p>
      </div>
    );
  };

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>Erro: {error}</p>;
  if (!budget) return <p>Orçamento não encontrado.</p>;

  console.log('Rendering budget:', budget);
  console.log('Products:', products);
  console.log('All accessories:', accessories);

  const budgetProducts = JSON.parse(budget.produtos_json || '[]');
  let budgetAccessories = [];
  try {
    budgetAccessories = JSON.parse(budget.acessorios_json || '[]');
    console.log('Raw accessories JSON:', budget.acessorios_json);
    console.log('Parsed accessories:', budgetAccessories);
    
    // Log each accessory ID for debugging
    if (budgetAccessories.length > 0) {
      console.log('Accessory IDs in budget:', budgetAccessories.map(a => {
        return {
          id: a.accessory_id,
          id_type: typeof a.accessory_id
        };
      }));
      
      // Log each accessory in the loaded accessories array
      console.log('Available accessory IDs:', accessories.map(a => {
        return {
          id: a.id, 
          id_type: typeof a.id,
          name: a.name
        };
      }));
    }
  } catch (e) {
    console.error('Error parsing accessories:', e);
  }

  return (
    <div className="budget-details-page">
      <div className="action-buttons-container">
        <button 
          onClick={() => navigate('/budgets')}
          className="back-button"
        >
          &larr; Voltar para Lista de Orçamentos
        </button>
        <button 
          onClick={handlePrintPDF}
          className="print-button"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="budget-print-layout" ref={contentRef}>
        <div className="company-header">
          {companyLogo && (
            <img 
              src={companyLogo} 
              alt="Logo da Empresa" 
              className="budget-logo"
            />
          )}
          {companyData && (
            <div className="company-info">
              <p>{companyData.nome_fantasia}</p>
              <p>{companyData.endereco}</p>
              <p>{companyData.email}</p>
              <p>Tel: {companyData.telefone}</p>
            </div>
          )}
        </div>
        <div className="budget-header">
          <h2>Orçamento #{budget.numero_orcamento || budget.id}</h2>
          <p>Data do Orçamento: {new Date(budget.created_at).toLocaleDateString()}</p>
          <p>Válido até: {calculateValidadeDate(budget.created_at, companyData?.validade_orcamento || 7)}</p>
        </div>

        {renderCustomerInfo()}

        <div className="budget-items">
          <h3>Itens do Orçamento</h3>
          <table className="budget-table">
            <colgroup>
              <col className="col-description" />
              <col className="col-quantity" />
              <col className="col-unit-price" />
              <col className="col-total" />
            </colgroup>
            <thead>
              <tr>
                <th className="description">DESCRIÇÃO</th>
                <th className="quantity">QTD</th>
                <th className="unit-price">VALOR UNIT.</th>
                <th className="total">VALOR TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group identical products
                const groupedProducts = {};
                
                budgetProducts.forEach(item => {
                  const productDetails = getProductDetails(item.produto_id);
                  const description = formatProductDescription(productDetails, item);
                  
                  // Create a key that uniquely identifies identical products
                  const key = `${item.produto_id}_${item.width}_${item.height}_${!!item.bando}_${!!item.installation}_${item.trilho_tipo}_${!!item.painel}_${item.numFolhas}`;
                  
                  if (!groupedProducts[key]) {
                    groupedProducts[key] = {
                      description,
                      quantity: 1,
                      unitPrice: Number(item.valor_total || item.subtotal || 0),
                      totalPrice: Number(item.valor_total || item.subtotal || 0),
                      details: item
                    };
                  } else {
                    groupedProducts[key].quantity += 1;
                    groupedProducts[key].totalPrice += Number(item.valor_total || item.subtotal || 0);
                  }
                });
                
                // Convert back to array for rendering
                return Object.values(groupedProducts).map((group, index) => (
                  <tr key={index}>
                    <td className="description">{group.description}</td>
                    <td className="quantity">{group.quantity}</td>
                    <td className="unit-price">{formatCurrency(group.unitPrice)}</td>
                    <td className="total">{formatCurrency(group.totalPrice)}</td>
                  </tr>
                ));
              })()}
              
              {/* Group identical accessories too */}
              {budgetAccessories && budgetAccessories.length > 0 && (() => {
                const groupedAccessories = {};
                
                budgetAccessories.forEach(item => {
                  const accessoryName = getAccessoryName(item.accessory_id);
                  const key = `${item.accessory_id}_${item.color}`;
                  
                  if (!groupedAccessories[key]) {
                    groupedAccessories[key] = {
                      description: accessoryName,
                      quantity: item.quantity || 1,
                      unitPrice: item.quantity && item.quantity > 0 ? (Number(item.valor_total || item.subtotal || 0) / item.quantity) : Number(item.valor_total || item.subtotal || 0),
                      totalPrice: Number(item.valor_total || item.subtotal || 0)
                    };
                  } else {
                    groupedAccessories[key].quantity += (item.quantity || 1);
                    groupedAccessories[key].totalPrice += Number(item.valor_total || item.subtotal || 0);
                  }
                });
                
                return Object.values(groupedAccessories).map((group, index) => (
                  <tr key={`acc-${index}`}>
                    <td className="description">{group.description}</td>
                    <td className="quantity">{group.quantity}</td>
                    <td className="unit-price">{formatCurrency(group.unitPrice)}</td>
                    <td className="total">{formatCurrency(group.totalPrice)}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          <div className="budget-total">
            Total: {formatCurrency(Number(budget.valor_total || 0))}
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button className="action-button print-button" onClick={handlePrintPDF}>
          Gerar PDF
        </button>
      </div>
    </div>
  );
}

export default BudgetDetailsPage;
