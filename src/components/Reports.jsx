import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import './Reports.css';
import { supabase } from '../supabase/client';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

function Reports({ budgets: initialBudgets }) {
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBudgets, setExpandedBudgets] = useState(new Set());
  const [selectedCharts, setSelectedCharts] = useState({
    status: true,
    revenue: true,
    products: true
  });
  const [produtos, setProdutos] = useState([]);
  
  // Usar useMemo para o defaultChartData para evitar recriação a cada renderização
  const defaultChartData = useMemo(() => ({
    statusChartData: {
      labels: ['Finalizados', 'Pendentes', 'Cancelados'],
      datasets: [
        {
          label: 'Status',
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(75, 192, 192, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(255, 99, 132, 0.2)',
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(255, 99, 132, 1)',
          ],
          borderWidth: 1,
        },
      ],
    },
    monthlyRevenueData: {
      labels: [],
      datasets: [
        {
          label: 'Receita',
          data: [],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Lucro',
          data: [],
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          fill: true,
          tension: 0.4
        },
      ],
    },
    topProductsData: {
      labels: [],
      datasets: [
        {
          label: 'Produtos Mais Vendidos',
          data: [],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    }
  }), []);

  const [summary, setSummary] = useState({
    total: 0,
    finalized: 0,
    pending: 0,
    canceled: 0,
    totalRevenue: 0,
    totalInstallation: 0,
    totalCosts: 0,
    totalProfit: 0,
    profitMargin: 0,
    averageTicket: 0,
    statusChartData: defaultChartData.statusChartData,
    monthlyRevenueData: defaultChartData.monthlyRevenueData,
    topProductsData: defaultChartData.topProductsData
  });

  // Buscar produtos do catálogo
  const fetchProdutos = useCallback(async () => {
    try {
      console.log('Buscando produtos do catálogo');
      const { data, error } = await supabase
        .from('produtos')
        .select('*');
        
      if (error) {
        console.error('Erro ao buscar produtos:', error);
        return;
      }
      
      if (data && Array.isArray(data)) {
        console.log(`${data.length} produtos encontrados no catálogo`);
        setProdutos(data);
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  }, []);

  // Função para buscar orçamentos
  const fetchBudgetsData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Iniciando busca de orçamentos - VERSÃO DETALHADA');
      
      // Se já temos orçamentos iniciais, usá-los diretamente
      if (initialBudgets && initialBudgets.length > 0) {
        console.log('Usando orçamentos fornecidos:', initialBudgets.length);
        setBudgets(initialBudgets);
        setLoading(false);
        return;
      }
      
      // Caso contrário, buscar do banco
      const { data: budgetsData, error } = await supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar orçamentos:', error);
        setLoading(false);
        return;
      }
      
      console.log('Orçamentos carregados:', budgetsData?.length || 0);
      setBudgets(budgetsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar orçamentos:', error);
      setBudgets([]);
      setLoading(false);
    }
  }, [initialBudgets]);

  // Buscar dados quando o componente montar
  useEffect(() => {
    console.log('Inicializando componente Reports');
    fetchProdutos();
    fetchBudgetsData();
  }, [fetchProdutos, fetchBudgetsData]);

  // Função para calcular dimensões do produto
  const calcularDimensoes = useCallback((product, width, height) => {
    try {
      if (!product || !width || !height) {
        console.warn('Dados incompletos para calcular dimensões');
        return null;
      }
      
      console.log('Calculando dimensões: ', { product, width, height });
      
      // Extrair mínimos do produto
      const minWidth = parseFloat(product.largura_minima || product.min_width || 0.5);
      const minHeight = parseFloat(product.altura_minima || product.min_height || 0.5);
      
      // Converter e validar dimensões
      const widthValue = parseFloat(width);
      const heightValue = parseFloat(height);
      
      if (isNaN(widthValue) || isNaN(heightValue)) {
        console.warn('Dimensões inválidas');
        return null;
      }
      
      // Verificar se precisa usar mínimos
      const usedWidth = widthValue < minWidth ? minWidth : widthValue;
      const usedHeight = heightValue < minHeight ? minHeight : heightValue;
      const usedMinimum = usedWidth !== widthValue || usedHeight !== heightValue;
      
      // Calcular área
      const area = usedWidth * usedHeight;
      
      const result = {
        width: usedWidth,
        height: usedHeight,
        area,
        usedMinimum,
        minimos: { width: minWidth, height: minHeight },
        originais: { width: widthValue, height: heightValue }
      };
      
      console.log('Dimensões calculadas: ', result);
      return result;
    } catch (error) {
      console.error('Erro ao calcular dimensões:', error);
      return null;
    }
  }, []);

  // Função para calcular preço baseado em dimensões
  const calcularPreco = useCallback((product, dimensions) => {
    try {
      if (!product || !dimensions) {
        console.warn('Dados incompletos para calcular preço');
        return null;
      }
      
      const { width, height, area } = dimensions;
      
      // Obter preços do produto
      const precoCusto = parseFloat(product.preco_custo || product.cost_price || 0);
      const precoVenda = parseFloat(product.preco_venda || product.sale_price || 0);
      
      // Verificar método de cálculo
      const metodoCalculo = product.metodo_calculo || product.calculation_method || 'Área';
      
      let custoFinal = 0;
      let valorFinal = 0;
      let formula = '';
      
      if (metodoCalculo === 'Metro Quadrado (m²)' || metodoCalculo === 'Área') {
        custoFinal = area * precoCusto;
        valorFinal = area * precoVenda;
        formula = 'largura * altura * preço';
      } else if (metodoCalculo === 'Metro Linear' || metodoCalculo === 'Linear') {
        // Considerando a largura como a dimensão linear
        custoFinal = width * precoCusto;
        valorFinal = width * precoVenda;
        formula = 'largura * preço';
      } else if (metodoCalculo === 'Unidade' || metodoCalculo === 'Unit') {
        custoFinal = precoCusto;
        valorFinal = precoVenda;
        formula = 'preço fixo por unidade';
      } else {
        // Padrão: cálculo por área
        custoFinal = area * precoCusto;
        valorFinal = area * precoVenda;
        formula = 'largura * altura * preço (padrão)';
      }
      
      const result = {
        largura: width,
        altura: height,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        custo_final: custoFinal,
        valor_final: valorFinal,
        formula
      };
      
      console.log('Cálculo Padrão: ', result);
      return result;
    } catch (error) {
      console.error('Erro ao calcular preço:', error);
      return null;
    }
  }, []);

  // Função para calcular custos de um item do orçamento
  const calcularCustoItem = useCallback((item, produtos) => {
    try {
      if (!item) {
        console.warn('Item inválido para cálculo de custo');
        return null;
      }
      
      console.log('Calculando custo para produto: ', item);
      
      // Encontrar o produto no catálogo
      let produtoCatalogo = null;
      if (produtos && Array.isArray(produtos) && item.produto_id) {
        produtoCatalogo = produtos.find(p => p.id === item.produto_id);
        if (produtoCatalogo) {
          console.log('Dados do produto encontrado: ', produtoCatalogo);
        }
      }
      
      // Obter dimensões
      const largura = parseFloat(item.largura || item.width || 0);
      const altura = parseFloat(item.altura || item.height || 0);
      
      // Calcular dimensões
      const dimensions = calcularDimensoes(
        produtoCatalogo || { 
          largura_minima: 0.5, 
          altura_minima: 0.5
        }, 
        largura, 
        altura
      );
      
      if (!dimensions) {
        console.warn('Não foi possível calcular dimensões');
        return null;
      }
      
      // Calcular custos do produto
      const produtoCalculo = produtoCatalogo ? 
        calcularPreco(produtoCatalogo, dimensions) : 
        {
          custo_final: parseFloat(item.valor_custo || item.cost_value || 0),
          valor_final: parseFloat(item.valor || item.value || 0)
        };
      
      // Calcular custos do bando (se existir)
      const bandoValor = parseFloat(item.valor_bando || item.band_value || 0);
      const bandoCusto = parseFloat(item.valor_bando_custo || item.band_cost || 0);
      
      // Calcular custos do trilho (se existir)
      const trilhoValor = parseFloat(item.valor_trilho || item.rail_value || 0);
      const trilhoCusto = parseFloat(item.trilho_custo || item.rail_cost || 0);
      
      const result = {
        produto: {
          custo: produtoCalculo ? produtoCalculo.custo_final : 0,
          valor: produtoCalculo ? produtoCalculo.valor_final : 0
        },
        bando: {
          custo: bandoCusto,
          valor: bandoValor
        },
        trilho: {
          custo: trilhoCusto,
          valor: trilhoValor
        }
      };
      
      console.log('Custos finais calculados: ', result);
      return result;
    } catch (error) {
      console.error('Erro ao calcular custos do item:', error);
      return null;
    }
  }, [calcularDimensoes, calcularPreco]);

  // Função para processar um orçamento completo
  const processarOrcamento = useCallback((budget, produtos) => {
    try {
      if (!budget) {
        console.warn('Orçamento inválido para processamento');
        return null;
      }
      
      console.log('Processando orçamento:', budget.id);
      
      // Extrair produtos do orçamento com suporte a múltiplos formatos de dados
      let produtosOrcamento = [];
      
      try {
        // Verificar todas as possíveis chaves onde os produtos podem estar armazenados
        let rawProductData = null;
        
        // Verificar múltiplos formatos possíveis
        if (budget.produtos) {
          rawProductData = budget.produtos;
        } else if (budget.products) {
          rawProductData = budget.products;
        } else if (budget.itens) {
          rawProductData = budget.itens;
        } else if (budget.items) {
          rawProductData = budget.items;
        }
        
        // Se encontrou algum dado, tentar parsear
        if (rawProductData) {
          // Converter string JSON para objeto, se necessário
          if (typeof rawProductData === 'string') {
            try {
              rawProductData = JSON.parse(rawProductData);
            } catch (e) {
              console.error('Erro ao parsear string JSON de produtos:', e);
            }
          }
          
          // Verificar se é um array
          if (Array.isArray(rawProductData)) {
            produtosOrcamento = rawProductData;
          } else if (typeof rawProductData === 'object') {
            // Se for um objeto, tentar converter para array
            produtosOrcamento = Object.values(rawProductData);
          }
        }
        
        // Log dos produtos encontrados
        console.log(`Produtos encontrados no orçamento ${budget.id}:`, produtosOrcamento);
        
        // Garantir que é um array
        if (!Array.isArray(produtosOrcamento)) {
          produtosOrcamento = [];
        }
      } catch (e) {
        console.error('Erro ao extrair produtos do orçamento:', e, budget);
        produtosOrcamento = [];
      }
      
      // Log para depuração
      console.log(`Orçamento ${budget.id} - ${produtosOrcamento.length} produtos encontrados`);
      
      // Processar cada item do orçamento
      const itensProcessados = produtosOrcamento.map(item => {
        try {
          // Determinar o ID do produto
          const produtoId = item.produto_id || item.product_id || item.productId || item.produtoId || item.id;
          
          // Encontrar o produto no catálogo
          const produtoCatalogo = produtos.find(p => p.id === produtoId);
          
          // Caso não encontre o produto no catálogo, usar os dados diretos do item
          if (!produtoCatalogo) {
            console.log(`Produto ID ${produtoId} não encontrado no catálogo para o orçamento ${budget.id}`);
          }
          
          // Extrair dimensões
          const largura = item.largura || item.width || item.dimensoes?.largura || item.dimensions?.width || 0;
          const altura = item.altura || item.height || item.dimensoes?.altura || item.dimensions?.height || 0;
          
          // Calcular custos e dimensões
          const custos = calcularCustoItem(item, produtos);
          const dimensoes = calcularDimensoes(produtoCatalogo, largura, altura);
          
          return {
            ...item,
            custos,
            dimensoes,
            produtoCatalogo,
            // Garantir que temos um nome para o produto
            nome: item.nome || item.name || 
                 (produtoCatalogo ? (produtoCatalogo.nome || produtoCatalogo.name) : 'Produto Sem Nome')
          };
        } catch (e) {
          console.error('Erro ao processar item do orçamento:', e, item);
          // Retornar um item com valores padrão em caso de erro
          return {
            ...item, 
            custos: {
              produto: { custo: 0, valor: 0 },
              bando: { custo: 0, valor: 0 },
              trilho: { custo: 0, valor: 0 }
            },
            dimensoes: { width: 0, height: 0, area: 0 },
            nome: item.nome || item.name || 'Produto com erro'
          };
        }
      });
      
      // Calcular totais
      let totalCost = 0;
      let totalValue = 0;
      let installationFee = 0;
      
      // Verificar se temos produtos processados
      if (itensProcessados.length > 0) {
        console.log(`Processando ${itensProcessados.length} itens para orçamento ${budget.id}`);
        itensProcessados.forEach(item => {
          if (item.custos) {
            // Somar custos do produto, bando e trilho
            totalCost += (item.custos.produto.custo || 0) + 
                        (item.custos.bando.custo || 0) + 
                        (item.custos.trilho.custo || 0);
            
            // Somar valores do produto, bando e trilho
            totalValue += (item.custos.produto.valor || 0) + 
                          (item.custos.bando.valor || 0) + 
                          (item.custos.trilho.valor || 0);
          }
          
          // Verificar se tem instalação
          const temInstalacao = item.instalacao === true || 
                                item.instalacao === 'true' || 
                                item.instalacao === 1 ||
                                item.installation === true || 
                                item.installation === 'true' ||
                                item.installation === 1;
                            
          if (temInstalacao) {
            const valorInstalacao = parseFloat(
              item.valor_instalacao || 
              item.installation_value || 
              item.installationValue || 
              item.valorInstalacao || 
              0
            );
            installationFee += valorInstalacao;
          }
        });
      } else {
        console.log(`Sem itens processados, usando valores diretos do orçamento ${budget.id}`);
        // FALLBACK: Se não conseguirmos processar os produtos, usar os valores diretos do orçamento
        totalValue = parseFloat(budget.total_price || 
                               budget.totalValue || 
                               budget.valor_total || 
                               budget.total || 
                               0);
                               
        // Estimar custo como 70% do valor se não estiver disponível
        totalCost = parseFloat(budget.total_cost || 
                              budget.totalCost || 
                              budget.custo_total || 
                              0) || (totalValue * 0.7);
                              
        // Verificar se há taxa de instalação definida no orçamento
        installationFee = parseFloat(budget.installation_fee || 
                                   budget.installationFee || 
                                   budget.taxa_instalacao || 
                                   0);
      }
      
      // Calcular valor sem instalação e lucro
      const valueWithoutInstallation = totalValue;
      const profit = valueWithoutInstallation - totalCost;
      const margin = valueWithoutInstallation > 0 ? (profit / valueWithoutInstallation) * 100 : 0;
      
      const result = {
        ...budget,
        itensProcessados,
        totalCost,
        totalValue,
        installationFee,
        valueWithoutInstallation,
        profit,
        margin
      };
      
      console.log('Totais calculados para orçamento ' + budget.id + ':', {
        totalCost,
        totalValue,
        installationFee,
        valueWithoutInstallation,
        profit,
        margin
      });
      
      return result;
    } catch (error) {
      console.error('Erro ao processar orçamento:', error, budget);
      
      // FALLBACK de segurança em caso de erro
      const totalValue = parseFloat(budget.total_price || 
                                   budget.totalValue || 
                                   budget.valor_total || 
                                   budget.total || 
                                   0);
                               
      const totalCost = parseFloat(budget.total_cost || 
                                  budget.totalCost || 
                                  budget.custo_total || 
                                  0) || (totalValue * 0.7);
                          
      const installationFee = parseFloat(budget.installation_fee || 
                                       budget.installationFee || 
                                       budget.taxa_instalacao || 
                                       0);
                          
      const profit = totalValue - totalCost - installationFee;
      const margin = totalValue > 0 ? (profit / totalValue) * 100 : 0;
      
      return {
        ...budget,
        itensProcessados: [],
        totalCost,
        totalValue,
        installationFee,
        valueWithoutInstallation: totalValue,
        profit,
        margin
      };
    }
  }, [calcularCustoItem, calcularDimensoes]);

  // Função para aplicar filtros de data - versão detalhada
  const getFilteredBudgetsByDate = useCallback((budgetsData) => {
    if (!budgetsData || !Array.isArray(budgetsData)) return [];
    
    if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59); // Incluir todo o dia final
      
      return budgetsData.filter(budget => {
        try {
          const budgetDate = new Date(budget.created_at);
          return budgetDate >= start && budgetDate <= end;
        } catch (e) {
          console.error('Erro ao filtrar orçamento por data:', e);
          return false;
        }
      });
    } else if (period === 'monthly') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      return budgetsData.filter(budget => {
        try {
          const budgetDate = new Date(budget.created_at);
          return budgetDate >= startOfMonth;
        } catch (e) {
          console.error('Erro ao filtrar orçamento por mês:', e);
          return false;
        }
      });
    } else if (period === 'quarterly') {
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      
      return budgetsData.filter(budget => {
        try {
          const budgetDate = new Date(budget.created_at);
          return budgetDate >= startOfQuarter;
        } catch (e) {
          console.error('Erro ao filtrar orçamento por trimestre:', e);
          return false;
        }
      });
    } else if (period === 'yearly') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      
      return budgetsData.filter(budget => {
        try {
          const budgetDate = new Date(budget.created_at);
          return budgetDate >= startOfYear;
        } catch (e) {
          console.error('Erro ao filtrar orçamento por ano:', e);
          return false;
        }
      });
    } else if (period === 'all') {
      return budgetsData;
    }
    
    return budgetsData;
  }, [period, startDate, endDate]);

  // Função para gerar dados do gráfico de status - versão detalhada
  const generateStatusChartData = useCallback((filteredBudgets) => {
    try {
      if (!filteredBudgets || !Array.isArray(filteredBudgets) || filteredBudgets.length === 0) {
        console.log('Nenhum orçamento disponível para gerar dados de status chart');
        return defaultChartData.statusChartData;
      }
      
      const finalized = filteredBudgets.filter(b => b && (b.status === 'finalizado' || b.status === 'finalized')).length;
      const pending = filteredBudgets.filter(b => b && (!b.status || b.status === 'pendente' || b.status === 'pending')).length;
      const canceled = filteredBudgets.filter(b => b && (b.status === 'cancelado' || b.status === 'canceled')).length;
      
      return {
        labels: ['Finalizados', 'Pendentes', 'Cancelados'],
        datasets: [
          {
            label: 'Status',
            data: [finalized, pending, canceled],
            backgroundColor: [
              'rgba(75, 192, 192, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(255, 99, 132, 0.2)',
            ],
            borderColor: [
              'rgba(75, 192, 192, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(255, 99, 132, 1)',
            ],
            borderWidth: 1,
          },
        ],
      };
    } catch (error) {
      console.error("Erro ao gerar dados de status chart:", error);
      return defaultChartData.statusChartData;
    }
  }, [defaultChartData]);

  // Função para gerar dados do gráfico de receita mensal - versão detalhada
  const generateMonthlyRevenueData = useCallback((processedBudgets) => {
    try {
      if (!processedBudgets || !Array.isArray(processedBudgets) || processedBudgets.length === 0) {
        console.log('Nenhum orçamento disponível para gerar dados de receita mensal');
        return defaultChartData.monthlyRevenueData;
      }
      
      const monthlyData = {};
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      processedBudgets.forEach(budget => {
        if (!budget) return;
        
        if (budget.status === 'finalizado' || budget.status === 'finalized') {
          try {
            // Validação defensiva da data
            const createdAt = budget.created_at;
            if (!createdAt) return;
            
            const date = new Date(createdAt);
            if (isNaN(date.getTime())) {
              console.warn('Data inválida encontrada:', createdAt);
              return;
            }
            
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            const monthName = months[date.getMonth()];
            
            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = {
                monthName,
                revenue: 0,
                profit: 0
              };
            }
            
            // Usar os valores calculados pelo processarOrcamento
            const totalValue = parseFloat(budget.totalValue || 0);
            const totalProfit = parseFloat(budget.profit || 0);
            
            if (!isNaN(totalValue)) {
              monthlyData[monthKey].revenue += totalValue;
            }
            
            if (!isNaN(totalProfit)) {
              monthlyData[monthKey].profit += totalProfit;
            }
          } catch (e) {
            console.error('Erro ao processar orçamento para receita mensal:', e, budget);
          }
        }
      });
      
      // Verificar se temos dados para gerar o gráfico
      if (Object.keys(monthlyData).length === 0) {
        console.log('Nenhum dado mensal calculado, retornando dados padrão');
        return defaultChartData.monthlyRevenueData;
      }
      
      // Ordenar meses
      const sortedMonths = Object.values(monthlyData).sort((a, b) => {
        const aIndex = months.indexOf(a.monthName);
        const bIndex = months.indexOf(b.monthName);
        return aIndex - bIndex;
      });
      
      return {
        labels: sortedMonths.map(data => data.monthName),
        datasets: [
          {
            label: 'Receita',
            data: sortedMonths.map(data => data.revenue),
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Lucro',
            data: sortedMonths.map(data => data.profit),
            borderColor: 'rgba(153, 102, 255, 1)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            fill: true,
            tension: 0.4
          },
        ],
      };
    } catch (error) {
      console.error("Erro ao gerar dados de receita mensal:", error);
      return defaultChartData.monthlyRevenueData;
    }
  }, [defaultChartData]);

  // Função para gerar dados do gráfico de produtos mais vendidos - versão detalhada
  const generateTopProductsData = useCallback((processedBudgets) => {
    try {
      if (!processedBudgets || !Array.isArray(processedBudgets) || processedBudgets.length === 0) {
        console.log('Nenhum orçamento disponível para gerar dados de produtos mais vendidos');
        return defaultChartData.topProductsData;
      }
      
      const productCounts = {};
      
      // Iterar sobre os orçamentos processados
      processedBudgets.forEach(budget => {
        if (!budget || !budget.itensProcessados || !Array.isArray(budget.itensProcessados)) return;
        
        if ((budget.status === 'finalizado' || budget.status === 'finalized')) {
          // Usar a nova estrutura de itensProcessados
          budget.itensProcessados.forEach(item => {
            if (!item) return;
            
            // Obter o nome do produto - verificar várias propriedades possíveis
            const prodName = item.nome || 
                            item.name || 
                            (item.produtoCatalogo ? (item.produtoCatalogo.nome || item.produtoCatalogo.name) : 'Desconhecido');
            
            if (!productCounts[prodName]) {
              productCounts[prodName] = 0;
            }
            productCounts[prodName]++;
          });
        }
      });
      
      // Verificar se temos produtos para gerar o gráfico
      if (Object.keys(productCounts).length === 0) {
        console.log('Nenhum produto encontrado, retornando dados padrão');
        return defaultChartData.topProductsData;
      }
      
      // Ordenar produtos por contagem
      const sortedProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Pegar os 10 mais vendidos
      
      return {
        labels: sortedProducts.map(([name]) => name),
        datasets: [
          {
            label: 'Produtos Mais Vendidos',
            data: sortedProducts.map(([, count]) => count),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      };
    } catch (error) {
      console.error("Erro ao gerar dados de produtos mais vendidos:", error);
      return defaultChartData.topProductsData;
    }
  }, [defaultChartData]);

  // Função principal para processar dados do relatório - VERSÃO DETALHADA
  useEffect(() => {
    const processReportDetailed = async () => {
      try {
        if (!budgets || !Array.isArray(budgets) || budgets.length === 0) {
          console.log('Nenhum orçamento disponível para processar');
          setLoading(false);
          setSummary(prevSummary => ({
            ...prevSummary,
            total: 0,
            finalized: 0,
            pending: 0,
            canceled: 0,
            totalRevenue: 0,
            totalInstallation: 0,
            totalCosts: 0,
            totalProfit: 0,
            profitMargin: 0,
            averageTicket: 0,
            statusChartData: defaultChartData.statusChartData,
            monthlyRevenueData: defaultChartData.monthlyRevenueData,
            topProductsData: defaultChartData.topProductsData
          }));
          setReportData([]);
          return;
        }
        
        setLoading(true);
        console.log(`Processando ${budgets.length} orçamentos`);
        
        // Filtrar orçamentos
        const filteredBudgets = getFilteredBudgetsByDate(budgets);
        
        if (!filteredBudgets || filteredBudgets.length === 0) {
          console.log('Nenhum orçamento após filtragem por data');
          setLoading(false);
          setSummary(prevSummary => ({
            ...prevSummary,
            total: 0,
            finalized: 0,
            pending: 0,
            canceled: 0,
            totalRevenue: 0,
            totalInstallation: 0,
            totalCosts: 0,
            totalProfit: 0,
            profitMargin: 0,
            averageTicket: 0,
            statusChartData: defaultChartData.statusChartData,
            monthlyRevenueData: defaultChartData.monthlyRevenueData,
            topProductsData: defaultChartData.topProductsData
          }));
          setReportData([]);
          return;
        }
        
        console.log(`Após filtragem: ${filteredBudgets.length} orçamentos`);
        
        // Calcular estatísticas básicas
        const finalized = filteredBudgets.filter(b => b && (b.status === 'finalizado' || b.status === 'finalized'));
        const pending = filteredBudgets.filter(b => b && (!b.status || b.status === 'pendente' || b.status === 'pending'));
        const canceled = filteredBudgets.filter(b => b && (b.status === 'cancelado' || b.status === 'canceled'));
        
        // Log para depuração
        console.log(`Status: Finalizados=${finalized.length}, Pendentes=${pending.length}, Cancelados=${canceled.length}`);
        
        // Processar dados dos orçamentos usando o novo método
        const processedBudgets = filteredBudgets.map(budget => {
          return processarOrcamento(budget, produtos);
        }).filter(budget => budget !== null);
        
        console.log(`Orçamentos processados: ${processedBudgets.length}`);
        
        // Calcular totais com validação de valores
        let totalRevenue = 0;
        let totalInstallation = 0;
        let totalCosts = 0;
        let totalProfit = 0;
        
        try {
          totalRevenue = processedBudgets.reduce((sum, b) => {
            const value = b?.totalValue || 0;
            if (isNaN(value)) return sum;
            return sum + value;
          }, 0);
          
          totalInstallation = processedBudgets.reduce((sum, b) => {
            const value = b?.installationFee || 0;
            if (isNaN(value)) return sum;
            return sum + value;
          }, 0);
          
          totalCosts = processedBudgets.reduce((sum, b) => {
            const value = b?.totalCost || 0;
            if (isNaN(value)) return sum;
            return sum + value;
          }, 0);
          
          totalProfit = processedBudgets.reduce((sum, b) => {
            const value = b?.profit || 0;
            if (isNaN(value)) return sum;
            return sum + value;
          }, 0);
          
          // Log para depuração
          console.log('Totais calculados para todos os orçamentos:', {
            totalRevenue,
            totalInstallation,
            totalCosts,
            totalProfit
          });
        } catch (error) {
          console.error('Erro ao calcular totais:', error);
        }
        
        // A margem é calculada sobre o valor total
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        
        // Preparar dados para os gráficos com tratamento de erros
        let statusChartData, monthlyRevenueData, topProductsData;
        
        try {
          statusChartData = generateStatusChartData(filteredBudgets);
        } catch (error) {
          console.error('Erro ao gerar dados do gráfico de status:', error);
          statusChartData = defaultChartData.statusChartData;
        }
        
        try {
          monthlyRevenueData = generateMonthlyRevenueData(processedBudgets);
        } catch (error) {
          console.error('Erro ao gerar dados do gráfico de receita mensal:', error);
          monthlyRevenueData = defaultChartData.monthlyRevenueData;
        }
        
        try {
          topProductsData = generateTopProductsData(processedBudgets);
        } catch (error) {
          console.error('Erro ao gerar dados do gráfico de produtos:', error);
          topProductsData = defaultChartData.topProductsData;
        }
        
        // Atualizar o resumo
        setSummary({
          total: filteredBudgets.length,
          finalized: finalized.length,
          pending: pending.length,
          canceled: canceled.length,
          totalRevenue,
          totalInstallation,
          totalCosts,
          totalProfit,
          profitMargin,
          averageTicket: finalized.length > 0 ? totalRevenue / finalized.length : 0,
          statusChartData,
          monthlyRevenueData,
          topProductsData
        });
        
        // Atualizar dados do relatório
        setReportData(processedBudgets);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao processar relatório detalhado:', error);
        setLoading(false);
        // Definir valores padrão
        setSummary(prevSummary => ({
          ...prevSummary,
          total: 0,
          finalized: 0,
          pending: 0,
          canceled: 0,
          totalRevenue: 0,
          totalInstallation: 0,
          totalCosts: 0,
          totalProfit: 0,
          profitMargin: 0,
          averageTicket: 0,
          statusChartData: defaultChartData.statusChartData,
          monthlyRevenueData: defaultChartData.monthlyRevenueData,
          topProductsData: defaultChartData.topProductsData
        }));
        setReportData([]);
      }
    };
    
    processReportDetailed();
  }, [budgets, period, startDate, endDate, getFilteredBudgetsByDate, generateStatusChartData, generateMonthlyRevenueData, generateTopProductsData, defaultChartData, produtos, processarOrcamento]);

  // Função para renderizar os gráficos
  const renderCharts = () => {
    const chartSection = [];
    
    if (selectedCharts.status && summary.statusChartData && Array.isArray(summary.statusChartData.labels) && summary.statusChartData.labels.length > 0) {
      chartSection.push(
        <div key="status-chart" className="chart-container">
          <Pie data={summary.statusChartData} options={{
            responsive: true,
            plugins: {
              legend: {
                position: 'right',
              },
              title: {
                display: true,
                text: 'Status dos Orçamentos',
              },
            },
          }} />
        </div>
      );
    }
    
    if (selectedCharts.revenue && summary.monthlyRevenueData && Array.isArray(summary.monthlyRevenueData.labels) && summary.monthlyRevenueData.labels.length > 0) {
      chartSection.push(
        <div key="revenue-chart" className="chart-container">
          <Line 
            data={summary.monthlyRevenueData} 
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `R$ ${value.toLocaleString('pt-BR')}`
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context) => `R$ ${context.raw.toLocaleString('pt-BR')}`
                  }
                }
              }
            }}
          />
        </div>
      );
    }
    
    if (selectedCharts.products && summary.topProductsData && Array.isArray(summary.topProductsData.labels) && summary.topProductsData.labels.length > 0) {
      chartSection.push(
        <div key="products-chart" className="chart-container">
          <Bar 
            data={summary.topProductsData} 
            options={{
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1
                  }
                }
              }
            }}
          />
        </div>
      );
    }
    
    if (chartSection.length === 0) {
      return <div className="no-data-message">Não há dados suficientes para gerar gráficos.</div>;
    }
    
    return (
      <div className="charts-grid">
        {chartSection}
      </div>
    );
  };

  // Função para aplicar filtros de data
  const handlePeriodChange = (event) => {
    setPeriod(event.target.value);
    if (event.target.value !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const toggleProductDetails = (budgetId) => {
    setExpandedBudgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(budgetId)) {
        newSet.delete(budgetId);
      } else {
        newSet.add(budgetId);
      }
      return newSet;
    });
  };

  // Configurações para o gráfico de barras
  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Receita e Lucro Mensal',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Valor (R$)'
        }
      }
    }
  };

  // Configurações para o gráfico de pizza
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Status dos Orçamentos',
      },
    },
  };

  return (
    <div className="reports-container">
      <h2>Relatório Gerencial</h2>

      <div className="filter-controls">
        <div className="period-selector">
          <label htmlFor="period">Período:</label>
          <select 
            id="period" 
            value={period} 
            onChange={handlePeriodChange}
          >
            <option value="daily">Hoje</option>
            <option value="weekly">Últimos 7 dias</option>
            <option value="monthly">Este mês</option>
            <option value="yearly">Este ano</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        
        {period === 'custom' && (
          <div className="date-range">
            <div>
              <label htmlFor="start-date">Data Inicial:</label>
              <input 
                type="date" 
                id="start-date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="end-date">Data Final:</label>
              <input 
                type="date" 
                id="end-date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button 
              className="apply-filter"
              onClick={() => processReportDetailed()}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
      
      <div className="chart-selection">
        <h3>Selecione os gráficos a serem exibidos:</h3>
        <div className="chart-checkboxes">
          <label>
            <input 
              type="checkbox" 
              checked={selectedCharts.status} 
              onChange={() => setSelectedCharts({...selectedCharts, status: !selectedCharts.status})}
            />
            Status dos Orçamentos
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={selectedCharts.revenue} 
              onChange={() => setSelectedCharts({...selectedCharts, revenue: !selectedCharts.revenue})}
            />
            Receita Mensal
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={selectedCharts.products} 
              onChange={() => setSelectedCharts({...selectedCharts, products: !selectedCharts.products})}
            />
            Produtos Mais Vendidos
          </label>
        </div>
      </div>
      
      {loading ? (
        <div className="loading">Carregando dados...</div>
      ) : (
        <>
          {renderCharts()}
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Orçamentos</h3>
              <p><strong>Total:</strong> {summary.total}</p>
              <p><strong>Finalizados:</strong> {summary.finalized}</p>
              <p><strong>Pendentes:</strong> {summary.pending}</p>
              <p><strong>Cancelados:</strong> {summary.canceled}</p>
            </div>
            <div className="summary-card">
              <h3>Financeiro</h3>
              <p><strong>Receita Total:</strong> R$ {summary.totalRevenue.toFixed(2)}</p>
              <p><strong>Custo Total:</strong> R$ {summary.totalCosts.toFixed(2)}</p>
              <p><strong>Lucro:</strong> R$ {summary.totalProfit.toFixed(2)}</p>
              <p><strong>Margem de Lucro:</strong> {summary.profitMargin.toFixed(2)}%</p>
            </div>
            <div className="summary-card">
              <h3>Métricas</h3>
              <p><strong>Ticket Médio:</strong> R$ {summary.averageTicket.toFixed(2)}</p>
              <p><strong>Total de Instalação:</strong> R$ {summary.totalInstallation.toFixed(2)}</p>
            </div>
          </div>

          <h3>Detalhes dos Orçamentos</h3>
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Total (R$)</th>
                  <th>Custo (R$)</th>
                  <th>Lucro (R$)</th>
                  <th>Margem (%)</th>
                  <th>Instalação (R$)</th>
                  <th>Status</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((budget) => (
                  <React.Fragment key={budget.id}>
                    <tr>
                      <td>{new Date(budget.created_at).toLocaleDateString()}</td>
                      <td>{budget.clientes?.name || budget.cliente?.name || budget.cliente_nome || 'Cliente não informado'}</td>
                      <td>{budget.totalValue?.toFixed(2)}</td>
                      <td>{budget.totalCost?.toFixed(2)}</td>
                      <td>{budget.profit?.toFixed(2)}</td>
                      <td>{budget.margin?.toFixed(2)}%</td>
                      <td>{budget.installationFee?.toFixed(2)}</td>
                      <td>
                        <span className={`status status-${budget.status || 'pendente'}`}>
                          {budget.status === 'finalizado' || budget.status === 'finalized' ? 'Finalizado' : 
                           budget.status === 'cancelado' || budget.status === 'canceled' ? 'Cancelado' : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="details-button"
                          onClick={() => toggleProductDetails(budget.id)}
                        >
                          {expandedBudgets.has(budget.id) ? 'Ocultar' : 'Exibir'}
                        </button>
                      </td>
                    </tr>
                    {expandedBudgets.has(budget.id) && (
                      <tr className="details-row">
                        <td colSpan="9">
                          <div className="product-details">
                            <h4>Produtos do Orçamento</h4>
                            {Array.isArray(budget.itensProcessados) && budget.itensProcessados.length > 0 ? (
                              <table className="product-detail-table">
                                <thead>
                                  <tr>
                                    <th>Produto</th>
                                    <th>Dimensões</th>
                                    <th>Custo</th>
                                    <th>Valor</th>
                                    <th>Lucro</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {budget.itensProcessados.map((product, index) => (
                                    <tr key={index} className="product-detail-item">
                                      <td>{product.nome || 'Produto Desconhecido'}</td>
                                      <td>{product.dimensoes.width.toFixed(2)}m x {product.dimensoes.height.toFixed(2)}m</td>
                                      <td>R$ {(product.custos?.produto?.custo || 0).toFixed(2)}</td>
                                      <td>R$ {(product.custos?.produto?.valor || 0).toFixed(2)}</td>
                                      <td>R$ {((product.custos?.produto?.valor || 0) - (product.custos?.produto?.custo || 0)).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="no-products-message">Nenhum produto disponível para este orçamento</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
