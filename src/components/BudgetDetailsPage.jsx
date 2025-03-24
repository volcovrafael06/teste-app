import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
    // Limitar o número de casas decimais para evitar valores muito longos
    return Number(value).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      maximumFractionDigits: 2
    });
  };

  const getProductDetails = (productId) => {
    return products.find(p => p.id === productId) || {};
  };

  const formatProductDescription = (product, item) => {
    // Extrair o percentual do nome do produto se for um SCREEN
    let screenPercentage = '';
    if (product.nome && product.nome.includes('SCREEN') && product.nome.includes('%')) {
      // Tenta extrair o percentual do nome do produto
      const percentMatch = product.nome.match(/SCREEN\s*(\d+)%/);
      if (percentMatch && percentMatch[1]) {
        screenPercentage = `SCREEN ${percentMatch[1]}%`;
      }
    }

    let parts = [];
    
    if (screenPercentage) {
      parts.push(screenPercentage);
    } else if (product.nome) {
      parts.push(product.nome);
    }
    
    if (product.modelo) parts.push(product.modelo);
    if (product.tecido) parts.push(product.tecido);
    if (product.codigo) parts.push(product.codigo);
    
    let description = parts.filter(Boolean).join(' - ');

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
    try {
      const content = contentRef.current;
      
      if (!content) return;

      // Use standard A4 dimensions
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Fix table column widths before capturing
      const tables = content.querySelectorAll('table');
      tables.forEach(table => {
        table.style.width = '100%';
        table.style.tableLayout = 'fixed';
        
        // Ensure the correct column widths are applied
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 3) {
            cells[0].style.width = '70%';
            cells[1].style.width = '15%';
            cells[2].style.width = '15%';
            
            // Make sure the first cell content is fully visible
            cells[0].style.wordBreak = 'break-word';
            cells[0].style.whiteSpace = 'normal';
            cells[0].style.overflowWrap = 'break-word';
            cells[0].style.maxWidth = '70%';
            cells[0].style.padding = '10px';
          }
        });
        
        // Set background color for header cells
        const headerCells = table.querySelectorAll('tr:first-child td');
        headerCells.forEach(cell => {
          cell.style.backgroundColor = '#f2f2f2';
        });
      });
      
      // Use html2canvas with higher quality settings
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate dimensions
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scaling to fit width
      const scale = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * scale;
      
      // Add to PDF
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
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  // Function to group identical products
  const groupIdenticalProducts = (products) => {
    const groupedProducts = [];
    const productMap = new Map();
    
    products.forEach(item => {
      const productDetails = getProductDetails(item.produto_id);
      const itemValue = Number(item.valor_total || item.subtotal || 0);
      
      // Create a unique key for each product based on its characteristics
      const key = JSON.stringify({
        produto_id: item.produto_id,
        largura: item.largura,
        altura: item.altura,
        bando: item.bando,
        instalacao: item.instalacao,
        trilho_tipo: item.trilho_tipo,
        painel: item.painel,
        // Include any other properties that make a product unique
      });
      
      if (productMap.has(key)) {
        // If we've seen this product before, increment its count and add to total
        const existingGroup = productMap.get(key);
        existingGroup.quantity += 1;
        existingGroup.totalValue += itemValue;
      } else {
        // If this is a new product, add it to the map
        productMap.set(key, {
          item,
          productDetails,
          quantity: 1,
          unitValue: itemValue,
          totalValue: itemValue
        });
      }
    });
    
    // Convert the map to an array
    productMap.forEach(group => {
      // Ensure unitValue is set correctly (especially for grouped items)
      if (group.quantity > 1) {
        group.unitValue = group.totalValue / group.quantity;
      }
      groupedProducts.push(group);
    });
    
    return groupedProducts;
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

  const groupedProducts = groupIdenticalProducts(budgetProducts);

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

        <div className="client-section">
          <h3>Itens do Orçamento</h3>
          
          <table border="1" cellSpacing="0" cellPadding="8" width="100%" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <td width="70%" style={{ fontWeight: 'bold', textAlign: 'left' }}>DESCRIÇÃO</td>
                <td width="15%" style={{ fontWeight: 'bold', textAlign: 'center' }}>QTD.</td>
                <td width="15%" style={{ fontWeight: 'bold', textAlign: 'right' }}>VALOR UNIT.</td>
              </tr>
              
              {groupedProducts.map((group, index) => (
                <tr key={index}>
                  <td style={{ 
                    textAlign: 'left', 
                    wordBreak: 'break-word', 
                    maxWidth: '70%', 
                    whiteSpace: 'normal', 
                    overflowWrap: 'break-word',
                    padding: '10px'
                  }}>
                    {formatProductDescription(group.productDetails, group.item)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {group.quantity}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(group.unitValue)}
                  </td>
                </tr>
              ))}
              
              {budgetAccessories && budgetAccessories.length > 0 && budgetAccessories.map((item, index) => (
                <tr key={`acc-${index}`}>
                  <td style={{ 
                    textAlign: 'left', 
                    wordBreak: 'break-word', 
                    maxWidth: '70%', 
                    whiteSpace: 'normal', 
                    overflowWrap: 'break-word',
                    padding: '10px'
                  }}>
                    <strong>Acessório {index + 1} - </strong>{getAccessoryName(item.accessory_id)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    1
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(Number(item.valor_total || item.subtotal || 0))}
                  </td>
                </tr>
              ))}
              
              <tr>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                <td colSpan="2" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {formatCurrency(
                    [...groupedProducts, ...(budgetAccessories || [])].reduce(
                      (total, item) => total + Number(item.totalValue || item.valor_total || item.subtotal || 0),
                      0
                    )
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="client-section" style={{ textAlign: 'right' }}>
          <strong>Total do Orçamento: {formatCurrency(Number(budget.valor_total || 0))}</strong>
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
