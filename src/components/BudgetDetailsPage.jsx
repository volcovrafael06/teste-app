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
          .eq('id', budgetId);

        if (budgetError) throw budgetError;
        
        // Make sure we get the first result if multiple rows are returned
        const budgetItem = budgetData && budgetData.length > 0 ? budgetData[0] : null;
        
        if (!budgetItem) {
          console.error('Budget not found');
          return;
        }

        console.log('Budget data loaded:', budgetItem);
        
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

        setBudget(budgetItem);
        setProducts(productsData);
        setAccessories(accessoriesData);
      } catch (error) {
        console.error('Error loading budget details:', error);
        setError(error.message);
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

  const getAccessoryName = (accessoryId) => {
    if (!accessories || !accessoryId) return 'Acessório não encontrado';
    const accessory = accessories.find(a => a.id === accessoryId);
    return accessory ? accessory.name : 'Acessório não encontrado';
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

        <div className="client-section">
          <h3>Cliente</h3>
          <p>Nome: {budget.clientes.name}</p>
          <p>Endereço: {budget.clientes.address}</p>
          <p>Telefone: {budget.clientes.phone}</p>
        </div>

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
