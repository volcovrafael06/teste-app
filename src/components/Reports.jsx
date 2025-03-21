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

  // Função para buscar orçamentos
  const fetchBudgetsData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Iniciando busca de orçamentos - VERSÃO SIMPLIFICADA');
      
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

  // Buscar orçamentos quando o componente montar
  useEffect(() => {
    fetchBudgetsData();
  }, [fetchBudgetsData]);

  // Função para aplicar filtros de data - versão simplificada
  const getFilteredBudgetsByDate = useCallback((budgetsData) => {
    if (!budgetsData || !Array.isArray(budgetsData)) return [];
    
    if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59); // Incluir todo o dia final
      
      return budgetsData.filter(budget => {
        const budgetDate = new Date(budget.created_at);
        return budgetDate >= start && budgetDate <= end;
      });
    } else if (period === 'monthly') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      return budgetsData.filter(budget => {
        const budgetDate = new Date(budget.created_at);
        return budgetDate >= startOfMonth;
      });
    } else if (period === 'quarterly') {
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      
      return budgetsData.filter(budget => {
        const budgetDate = new Date(budget.created_at);
        return budgetDate >= startOfQuarter;
      });
    } else if (period === 'yearly') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      
      return budgetsData.filter(budget => {
        const budgetDate = new Date(budget.created_at);
        return budgetDate >= startOfYear;
      });
    } else if (period === 'all') {
      return budgetsData;
    }
    
    return budgetsData;
  }, [period, startDate, endDate]);

  // Função para gerar dados do gráfico de status - simplificada
  const generateStatusChartData = useCallback((filteredBudgets) => {
    try {
      if (!filteredBudgets || filteredBudgets.length === 0) {
        return defaultChartData.statusChartData;
      }
      
      const finalized = filteredBudgets.filter(b => b.status === 'finalizado' || b.status === 'finalized').length;
      const pending = filteredBudgets.filter(b => !b.status || b.status === 'pendente' || b.status === 'pending').length;
      const canceled = filteredBudgets.filter(b => b.status === 'cancelado' || b.status === 'canceled').length;
      
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

  // Função para gerar dados do gráfico de receita mensal - simplificada
  const generateMonthlyRevenueData = useCallback((filteredBudgets) => {
    try {
      if (!filteredBudgets || filteredBudgets.length === 0) {
        return defaultChartData.monthlyRevenueData;
      }
      
      const monthlyData = {};
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      filteredBudgets.forEach(budget => {
        if (budget.status === 'finalizado' || budget.status === 'finalized') {
          const date = new Date(budget.created_at);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const monthName = months[date.getMonth()];
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              monthName,
              revenue: 0,
              profit: 0
            };
          }
          
          const totalValue = parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0);
          monthlyData[monthKey].revenue += totalValue;
          
          // Estimativa simples de lucro como 30% da receita
          monthlyData[monthKey].profit += totalValue * 0.3;
        }
      });
      
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
            label: 'Lucro Estimado',
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

  // Função para gerar dados do gráfico de produtos mais vendidos - simplificada
  const generateTopProductsData = useCallback((filteredBudgets) => {
    try {
      if (!filteredBudgets || filteredBudgets.length === 0) {
        return defaultChartData.topProductsData;
      }
      
      const productCounts = {};
      
      filteredBudgets.forEach(budget => {
        if ((budget.status === 'finalizado' || budget.status === 'finalized')) {
          let produtos = [];
          
          try {
            // Extrair produtos primeiro
            if (budget.produtos) {
              produtos = typeof budget.produtos === 'string' ? JSON.parse(budget.produtos) : budget.produtos;
            } else if (budget.products) {
              produtos = typeof budget.products === 'string' ? JSON.parse(budget.products) : budget.products;
            }
          } catch (e) {
            console.error('Erro ao processar produtos:', e);
          }
          
          if (Array.isArray(produtos)) {
            produtos.forEach(prod => {
              const prodName = prod.nome || prod.name || 'Desconhecido';
              if (!productCounts[prodName]) {
                productCounts[prodName] = 0;
              }
              productCounts[prodName]++;
            });
          }
        }
      });
      
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

  // Função principal para processar dados do relatório - VERSÃO SIMPLIFICADA
  useEffect(() => {
    const processReportSimplified = async () => {
      try {
        if (!budgets || budgets.length === 0) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        
        // Filtrar orçamentos
        const filteredBudgets = getFilteredBudgetsByDate(budgets);
        
        // Calcular estatísticas básicas
        const finalized = filteredBudgets.filter(b => b.status === 'finalizado' || b.status === 'finalized');
        const pending = filteredBudgets.filter(b => !b.status || b.status === 'pendente' || b.status === 'pending');
        const canceled = filteredBudgets.filter(b => b.status === 'cancelado' || b.status === 'canceled');
        
        // Processar dados dos orçamentos para exibição
        const processedBudgets = filteredBudgets.map(budget => {
          // Log específico para o orçamento #1006
          if (budget.id === 1006 || budget.id === '1006') {
            console.log('ANÁLISE COMPLETA - Orçamento #1006:', JSON.stringify(budget, null, 2));
            
            // Verificar se existem campos específicos
            console.log('Estrutura do orçamento #1006:');
            console.log('- produtos:', budget.produtos ? 'presente' : 'ausente');
            console.log('- products:', budget.products ? 'presente' : 'ausente');
            console.log('- acessorios:', budget.acessorios ? 'presente' : 'ausente');
            console.log('- accessories:', budget.accessories ? 'presente' : 'ausente');
            console.log('- bandos:', budget.bandos ? 'presente' : 'ausente');
            console.log('- bands:', budget.bands ? 'presente' : 'ausente');
            console.log('- trilhos:', budget.trilhos ? 'presente' : 'ausente');
            console.log('- rails:', budget.rails ? 'presente' : 'ausente');
          }
          
          // O preço de custo deve ser obtido diretamente de cada produto
          let totalCost = 0;
          let produtos = [];
          let acessorios = [];
          let bandos = [];
          let trilhos = [];
          
          try {
            // Extrair produtos
            if (budget.produtos) {
              produtos = typeof budget.produtos === 'string' ? JSON.parse(budget.produtos) : budget.produtos;
            } else if (budget.products) {
              produtos = typeof budget.products === 'string' ? JSON.parse(budget.products) : budget.products;
            }
            
            // Extrair acessórios
            if (budget.acessorios) {
              acessorios = typeof budget.acessorios === 'string' ? JSON.parse(budget.acessorios) : budget.acessorios;
            } else if (budget.accessories) {
              acessorios = typeof budget.accessories === 'string' ? JSON.parse(budget.accessories) : budget.accessories;
            } else if (budget.acessorios_json) {
              acessorios = typeof budget.acessorios_json === 'string' ? JSON.parse(budget.acessorios_json) : budget.acessorios_json;
            }
            
            // Extrair bandos
            if (budget.bandos) {
              bandos = typeof budget.bandos === 'string' ? JSON.parse(budget.bandos) : budget.bandos;
            } else if (budget.bands) {
              bandos = typeof budget.bands === 'string' ? JSON.parse(budget.bands) : budget.bands;
            }
            
            // Extrair trilhos
            if (budget.trilhos) {
              trilhos = typeof budget.trilhos === 'string' ? JSON.parse(budget.trilhos) : budget.trilhos;
            } else if (budget.rails) {
              trilhos = typeof budget.rails === 'string' ? JSON.parse(budget.rails) : budget.rails;
            }
          } catch (e) {
            console.error('Erro ao processar itens:', e);
          }
          
          // Log detalhado para o orçamento #1006
          if (budget.id === 1006 || budget.id === '1006') {
            console.log('PRODUTOS DO ORÇAMENTO #1006:', JSON.stringify(produtos, null, 2));
            console.log('ACESSÓRIOS DO ORÇAMENTO #1006:', JSON.stringify(acessorios, null, 2));
            console.log('BANDOS DO ORÇAMENTO #1006:', JSON.stringify(bandos, null, 2));
            console.log('TRILHOS DO ORÇAMENTO #1006:', JSON.stringify(trilhos, null, 2));
          }
          
          // Função para extrair preço de custo de um item
          const extrairPrecoCusto = (item) => {
            if (!item) return 0;
            
            let precoCusto = 0;
            
            // Caso especial para o produto 5539 (SCREEN) no orçamento #1006
            if (budget.id === 1006 || budget.id === '1006') {
              if (item.id === 5539 || item.id === '5539' || (item.nome && item.nome.includes('SCREEN'))) {
                console.log('Produto SCREEN detectado no orçamento #1006:', item);
                
                // Preço de custo fixo para este produto
                const custoM2 = 109.89;
                
                // Extrair dimensões
                const altura = parseFloat(item.altura || item.height || 0);
                const largura = parseFloat(item.largura || item.width || 0);
                
                // Calcular área
                const area = altura * largura;
                
                if (area > 0) {
                  precoCusto = custoM2 * area;
                  console.log(`Calculado preço de custo para SCREEN: ${custoM2} * ${area}m² = ${precoCusto}`);
                  return precoCusto;
                }
              }
            }
            
            // Verificar todos os possíveis campos de preço de custo
            if (item.cost_price !== undefined) {
              precoCusto = parseFloat(item.cost_price);
            } else if (item.preco_custo !== undefined) {
              precoCusto = parseFloat(item.preco_custo);
            } else if (item.precio_costo !== undefined) {
              precoCusto = parseFloat(item.precio_costo);
            } else if (item.preço_custo !== undefined) {
              precoCusto = parseFloat(item.preço_custo);
            } else if (item.valor_bando_custo !== undefined) {
              precoCusto = parseFloat(item.valor_bando_custo);
            } else if (item.band_cost !== undefined) {
              precoCusto = parseFloat(item.band_cost);
            } else if (item.bando_custo !== undefined) {
              precoCusto = parseFloat(item.bando_custo);
            } else if (item.trilho_custo !== undefined) {
              precoCusto = parseFloat(item.trilho_custo);
            } else if (item.rail_cost !== undefined) {
              precoCusto = parseFloat(item.rail_cost);
            }
            
            // Verificar método de cálculo para aplicar m²
            if (precoCusto <= 0 && (item.metodo_calculo === 'Metro Quadrado (m²)' || item.calculation_method === 'Metro Quadrado (m²)')) {
              const custoM2 = parseFloat(item.preco_m2 || item.cost_per_m2 || item.price_m2 || 0);
              if (custoM2 > 0) {
                const altura = parseFloat(item.altura || item.height || 0);
                const largura = parseFloat(item.largura || item.width || 0);
                const area = altura * largura;
                
                if (area > 0) {
                  precoCusto = custoM2 * area;
                  console.log(`Calculado preço por m²: ${custoM2} * ${area}m² = ${precoCusto}`);
                }
              }
            }
            
            return isNaN(precoCusto) ? 0 : precoCusto;
          };
          
          // Processar produtos
          if (Array.isArray(produtos)) {
            produtos.forEach(prod => {
              // Log detalhado do produto para análise
              if (budget.id === 1006 || budget.id === '1006') {
                console.log(`Analisando produto em orçamento #1006:`, prod);
                console.log(`ID do produto:`, prod.id);
                console.log(`Nome do produto:`, prod.nome || prod.name);
                console.log(`Método de cálculo:`, prod.metodo_calculo || prod.calculation_method);
                console.log(`Dimensões:`, {
                  altura: prod.altura || prod.height,
                  largura: prod.largura || prod.width
                });
              }
              
              const precoCusto = extrairPrecoCusto(prod);
              if (precoCusto > 0) {
                console.log('Preço de custo encontrado para produto:', precoCusto, 'para:', prod.nome || prod.name);
                totalCost += precoCusto;
              } else {
                console.log('Preço de custo NÃO encontrado para produto:', prod.nome || prod.name);
              }
            });
          }
          
          // Processar acessórios
          if (Array.isArray(acessorios)) {
            acessorios.forEach(acessorio => {
              const precoCusto = extrairPrecoCusto(acessorio);
              if (precoCusto > 0) {
                console.log('Preço de custo encontrado para acessório:', precoCusto, 'para:', acessorio.nome || acessorio.name);
                totalCost += precoCusto;
              }
            });
          }
          
          // Processar bandos
          if (Array.isArray(bandos)) {
            bandos.forEach(bando => {
              const precoCusto = extrairPrecoCusto(bando);
              if (precoCusto > 0) {
                console.log('Preço de custo encontrado para bando:', precoCusto, 'para:', bando.nome || bando.name);
                totalCost += precoCusto;
              }
            });
          }
          
          // Processar trilhos
          if (Array.isArray(trilhos)) {
            trilhos.forEach(trilho => {
              const precoCusto = extrairPrecoCusto(trilho);
              if (precoCusto > 0) {
                console.log('Preço de custo encontrado para trilho:', precoCusto, 'para:', trilho.nome || trilho.name);
                totalCost += precoCusto;
              }
            });
          }
          
          // Verificar se o custo total é válido, senão usar fallback
          if (isNaN(totalCost) || totalCost <= 0) {
            console.warn('Preço de custo não encontrado para orçamento:', budget.id);
            // Fallback para estimativa como solicitado
            totalCost = parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0) * 0.7; // Estimativa de 70% como fallback
            console.log('Usando estimativa de custo:', totalCost);
          }
          
          // Processar produtos para instalação
          let installationFee = 0;
          
          try {
            // Log para debugging
            console.log('Produtos do orçamento:', budget.id, produtos);
            
            // Calcular taxa de instalação
            if (Array.isArray(produtos)) {
              produtos.forEach(prod => {
                // Verificar várias propriedades possíveis para instalação
                const temInstalacao = prod.instalacao === true || 
                                      prod.instalacao === 'true' || 
                                      prod.instalacao === 1 ||
                                      prod.installation === true || 
                                      prod.installation === 'true' ||
                                      prod.installation === 1;
                                   
                if (temInstalacao) {
                  // Verificar várias propriedades possíveis para valor de instalação
                  const valorInstalacao = parseFloat(
                    prod.valor_instalacao || 
                    prod.installation_value || 
                    prod.installationValue || 
                    prod.valorInstalacao || 
                    0
                  );
                  installationFee += valorInstalacao;
                  console.log('Valor de instalação encontrado:', valorInstalacao, 'para produto:', prod.nome || prod.name);
                }
              });
            }
          } catch (e) {
            console.error('Erro ao processar produtos para instalação:', e);
          }
          
          // Lucro = Preço de venda - Preço de custo - Instalação
          const profit = parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0) - totalCost - installationFee;
          
          // Margem = % que o lucro representa do total
          const margin = parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0) > 0 ? (profit / parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0)) * 100 : 0;
          
          console.log('Orçamento processado (valores reais):', {
            id: budget.id,
            totalValue: parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0),
            totalCost,
            installationFee,
            profit,
            margin
          });
          
          return {
            ...budget,
            totalValue: parseFloat(budget.total_price || budget.totalValue || budget.valor_total || 0),
            totalCost,
            installationFee,
            profit,
            margin,
            produtos_processados: Array.isArray(produtos) ? produtos.map(prod => {
              // Usar a função de extração de preço de custo
              const precoCusto = extrairPrecoCusto(prod);
              
              // Se preço de custo for zero, usar estimativa
              const prodCusto = precoCusto > 0 ? precoCusto : (prod.valor || prod.value || 0) * 0.7;
              
              // Lucro = Preço de venda - Preço de custo - Instalação
              const prodValor = parseFloat(prod.valor || prod.value || 0);
              const valorInstalacao = parseFloat(
                prod.valor_instalacao || 
                prod.installation_value || 
                prod.installationValue || 
                prod.valorInstalacao || 
                0
              );
              
              const prodLucro = prodValor - prodCusto - valorInstalacao;
              
              return {
                ...prod,
                total: prodValor,
                totalCost: prodCusto,
                profit: prodLucro,
                valor_instalacao: valorInstalacao,
                tem_instalacao: prod.instalacao === true || 
                                prod.instalacao === 'true' || 
                                prod.instalacao === 1 ||
                                prod.installation === true || 
                                prod.installation === 'true' ||
                                prod.installation === 1
              };
            }) : []
          };
        });
        
        // Calcular totais
        const totalRevenue = finalized.reduce((sum, b) => {
          const value = parseFloat(b.total_price || b.totalValue || b.valor_total || 0);
          return sum + value;
        }, 0);
        
        // Calcular valor total de instalação
        const totalInstallation = processedBudgets.reduce((sum, b) => {
          return sum + (b.installationFee || 0);
        }, 0);
        
        console.log('Total instalação calculado:', totalInstallation);
        
        // Cálculo simplificado de lucro
        const totalCosts = processedBudgets.reduce((sum, b) => {
          return sum + (b.totalCost || 0);
        }, 0);
        const totalProfit = totalRevenue - totalCosts - totalInstallation;
        
        // A margem é calculada sobre o valor total
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        
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
          statusChartData: generateStatusChartData(filteredBudgets),
          monthlyRevenueData: generateMonthlyRevenueData(filteredBudgets),
          topProductsData: generateTopProductsData(filteredBudgets)
        });
        
        // Atualizar dados do relatório
        setReportData(processedBudgets);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao processar relatório simplificado:', error);
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
        }));
        setReportData([]);
      }
    };
    
    processReportSimplified();
  }, [budgets, period, startDate, endDate, getFilteredBudgetsByDate, generateStatusChartData, generateMonthlyRevenueData, generateTopProductsData]);

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
              onClick={() => processReportSimplified()}
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
          <div className="charts-section">
            <h3>Análise Gráfica</h3>
            <div className="charts-container">
              {selectedCharts.status && (
                <div className="chart-card">
                  <h4>Status dos Orçamentos</h4>
                  <div className="chart-wrapper">
                    <Pie data={summary.statusChartData} />
                  </div>
                </div>
              )}
              
              {selectedCharts.revenue && (
                <div className="chart-card">
                  <h4>Receita Mensal</h4>
                  <div className="chart-wrapper">
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
                </div>
              )}
              
              {selectedCharts.products && (
                <div className="chart-card">
                  <h4>Produtos Mais Vendidos</h4>
                  <div className="chart-wrapper">
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
                </div>
              )}
            </div>
          </div>

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
                            {Array.isArray(budget.produtos_processados) && budget.produtos_processados.length > 0 ? (
                              budget.produtos_processados.map((product, index) => (
                                <div key={index} className="product-detail-item">
                                  <h5>{product.nome || product.name || product.produto?.nome || product.product?.name || 'Produto Desconhecido'}</h5>
                                  <div className="product-info-section">
                                    <p><strong>Dimensões:</strong> {product.largura || product.width || 0}m x {product.altura || product.height || 0}m</p>
                                    <p><strong>Custo:</strong> R$ {product.totalCost?.toFixed(2) || '0.00'}</p>
                                    <p><strong>Valor:</strong> R$ {product.total?.toFixed(2) || '0.00'}</p>
                                    <p><strong>Lucro:</strong> R$ {product.profit?.toFixed(2) || '0.00'}</p>
                                  </div>

                                  {product.bando && (
                                    <div className="bando-section">
                                      <h6>Bandô</h6>
                                      <p><strong>Tipo:</strong> {product.bando}</p>
                                      <p><strong>Custo:</strong> R$ {product.cost?.bandoCost?.toFixed(2) || '0.00'}</p>
                                      <p><strong>Valor:</strong> R$ {product.cost?.bandoValue?.toFixed(2) || '0.00'}</p>
                                    </div>
                                  )}

                                  {product.trilho_tipo && (
                                    <div className="trilho-section">
                                      <h6>Trilho</h6>
                                      <p><strong>Tipo:</strong> {product.trilho_tipo}</p>
                                      <p><strong>Custo:</strong> R$ {product.cost?.trilhoCost?.toFixed(2) || '0.00'}</p>
                                      <p><strong>Valor:</strong> R$ {product.cost?.trilhoValue?.toFixed(2) || '0.00'}</p>
                                    </div>
                                  )}

                                  {product.tem_instalacao && (
                                    <div className="installation-section">
                                      <h6>Instalação</h6>
                                      <p><strong>Valor:</strong> R$ {parseFloat(product.valor_instalacao || 0).toFixed(2)}</p>
                                    </div>
                                  )}

                                  <div className="subtotal">
                                    <p><strong>Subtotal:</strong> R$ {(product.total + (product.valor_instalacao || 0))?.toFixed(2) || '0.00'}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p>Nenhum produto disponível para este orçamento</p>
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
