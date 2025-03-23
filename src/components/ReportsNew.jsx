import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase/client';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import './Reports.css';
import { FaSearch, FaFilter, FaChartBar, FaTable, FaCalendarAlt, FaUser, FaFileInvoiceDollar, FaInfoCircle } from 'react-icons/fa';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

function ReportsNew({ budgets = [], customers = [] }) {
  // Estados principais
  const [orcamentos, setOrcamentos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dados processados para relatórios
  const [financialData, setFinancialData] = useState({
    dre: {
      receitas: 0,
      custosProdutos: 0,
      custosMateriais: 0,
      custosInstalacao: 0,
      custosOperacionais: 0,
      despesasComerciais: 0,
      despesasAdministrativas: 0,
      lucroOperacional: 0,
      margem: 0
    },
    fluxoCaixa: [],
    analiseOrcamentos: [],
    metricas: {
      ticketMedio: 0,
      taxaConversao: 0,
      totalVendas: 0,
      margemMedia: 0,
      produtosMaisVendidos: []
    },
    graficos: {
      receitaMensal: { labels: [], datasets: [] },
      receitaVsCusto: { labels: [], datasets: [] },
      margemPorProduto: { labels: [], datasets: [] },
      distribuicaoVendas: { labels: [], datasets: [] }
    }
  });
  
  // Estados de filtro
  const [filterOptions, setFilterOptions] = useState({
    period: 'monthly',
    startDate: '',
    endDate: '',
    status: 'all',
    cliente: 'all',
    produto: 'all'
  });
  
  // Guias de relatório
  const [activeTab, setActiveTab] = useState('resumo');
  const [detalhamentoVisivel, setDetalhamentoVisivel] = useState(false);
  const [orcamentoDetalhado, setOrcamentoDetalhado] = useState(null);

  // Buscar dados iniciais
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Inicializando busca de dados...');
      
      // Usar orçamentos passados como prop se disponíveis, senão buscar do Supabase
      if (budgets && budgets.length > 0) {
        console.log(`Usando ${budgets.length} orçamentos passados via props`);
        setOrcamentos(budgets);
      } else {
        // Buscar orçamentos do Supabase
        const { data: orcamentosData, error: orcamentosError } = await supabase
          .from('orcamentos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (orcamentosError) {
          console.error('Erro ao buscar orçamentos:', orcamentosError);
          setError('Falha ao buscar orçamentos. Por favor, tente novamente.');
          setLoading(false);
          return;
        }
        
        setOrcamentos(orcamentosData || []);
        console.log(`${orcamentosData ? orcamentosData.length : 0} orçamentos carregados`);
      }
      
      // Usar clientes passados como prop se disponíveis, senão buscar do Supabase
      if (customers && customers.length > 0) {
        console.log(`Usando ${customers.length} clientes passados via props`);
        setClientes(customers);
      } else {
        // Buscar clientes do Supabase
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('*');
        
        if (clientesError) {
          console.error('Erro ao buscar clientes:', clientesError);
          setError('Falha ao buscar clientes. Por favor, tente novamente.');
          setLoading(false);
          return;
        }
        
        setClientes(clientesData || []);
        console.log(`${clientesData ? clientesData.length : 0} clientes carregados`);
      }
      
      // Buscar produtos do Supabase
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*');
      
      if (produtosError) {
        console.error('Erro ao buscar produtos:', produtosError);
        setError('Falha ao buscar produtos. Por favor, tente novamente.');
        setLoading(false);
        return;
      }
      
      setProdutos(produtosData || []);
      console.log(`${produtosData ? produtosData.length : 0} produtos carregados`);
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Ocorreu um erro inesperado. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Aplicar filtros aos orçamentos
  const applyFilters = () => {
    try {
      const filteredOrcamentos = orcamentos.filter(orcamento => {
        // Verificar se o orçamento existe e tem data
        if (!orcamento || !orcamento.created_at) return false;
        
        try {
          // Filtro de período
          const orcamentoDate = new Date(orcamento.created_at);
          let startDateFilter = new Date(0); // 1970
          let endDateFilter = new Date();
          
          // Configurar filtro de data com base no período selecionado
          if (filterOptions.period === 'daily') {
            startDateFilter = new Date();
            startDateFilter.setHours(0, 0, 0, 0);
          } else if (filterOptions.period === 'weekly') {
            startDateFilter = new Date();
            startDateFilter.setDate(startDateFilter.getDate() - 7);
          } else if (filterOptions.period === 'monthly') {
            startDateFilter = new Date();
            startDateFilter.setMonth(startDateFilter.getMonth() - 1);
          } else if (filterOptions.period === 'yearly') {
            startDateFilter = new Date();
            startDateFilter.setFullYear(startDateFilter.getFullYear() - 1);
          } else if (filterOptions.period === 'custom') {
            if (filterOptions.startDate) {
              startDateFilter = new Date(filterOptions.startDate);
              startDateFilter.setHours(0, 0, 0, 0);
            }
            
            if (filterOptions.endDate) {
              endDateFilter = new Date(filterOptions.endDate);
              endDateFilter.setHours(23, 59, 59, 999);
            }
          }
          
          // Verificar a data
          if (orcamentoDate < startDateFilter || orcamentoDate > endDateFilter) {
            return false;
          }
          
          // Filtro de status
          if (filterOptions.status !== 'all' && orcamento.status !== filterOptions.status) {
            return false;
          }
          
          // Filtro de cliente
          if (filterOptions.cliente !== 'all' && String(orcamento.cliente_id) !== String(filterOptions.cliente)) {
            return false;
          }
          
          // Passou em todos os filtros
          return true;
        } catch (e) {
          console.error('Erro ao filtrar orçamento:', e);
          return false;
        }
      });
      
      return filteredOrcamentos;
    } catch (err) {
      console.error('Erro ao aplicar filtros:', err);
      return orcamentos;
    }
  };

  // Processar dados quando orçamentos, produtos ou filtros mudarem
  const processFinancialData = useCallback(() => {
    try {
      const filteredOrcamentos = applyFilters();
      
      if (!filteredOrcamentos || filteredOrcamentos.length === 0) {
        // Inicializar dados vazios
        setFinancialData({
          dre: {
            receitas: 0,
            custosProdutos: 0,
            custosMateriais: 0,
            custosInstalacao: 0,
            custosOperacionais: 0,
            despesasComerciais: 0,
            despesasAdministrativas: 0,
            lucroOperacional: 0,
            margem: 0
          },
          fluxoCaixa: [],
          analiseOrcamentos: [],
          metricas: {
            ticketMedio: 0,
            taxaConversao: 0,
            totalVendas: 0,
            margemMedia: 0,
            produtosMaisVendidos: []
          },
          graficos: {
            receitaMensal: { labels: [], datasets: [] },
            receitaVsCusto: { labels: [], datasets: [] },
            margemPorProduto: { labels: [], datasets: [] },
            distribuicaoVendas: { labels: [], datasets: [] }
          }
        });
        return;
      }
      
      // Processar orçamentos
      const orcamentosProcessados = filteredOrcamentos.map(orcamento => {
        try {
          // Extrair produtos do JSON
          let produtosOrcamento = [];
          try {
            if (orcamento.produtos_json) {
              produtosOrcamento = JSON.parse(orcamento.produtos_json);
            } else if (orcamento.produtos) {
              produtosOrcamento = typeof orcamento.produtos === 'string' ?
                JSON.parse(orcamento.produtos) : orcamento.produtos;
            }
          } catch (error) {
            console.error(`Erro ao parsear produtos do orçamento ${orcamento.id}:`, error);
            produtosOrcamento = [];
          }
          
          if (!Array.isArray(produtosOrcamento)) {
            produtosOrcamento = [];
          }
          
          // Processar produtos do orçamento
          const produtosProcessados = produtosOrcamento.map(produto => {
            try {
              // Encontrar produto no catálogo
              const produtoCatalogo = produtos.find(p => String(p.id) === String(produto.produto_id));
              
              // Calcular área
              const largura = parseFloat(produto.largura || 0);
              const altura = parseFloat(produto.altura || 0);
              const area = largura * altura;
              
              // Calcular valores
              const subtotal = parseFloat(produto.subtotal || 0);
              const valorBando = parseFloat(produto.valor_bando || 0);
              let custoBando = parseFloat(produto.valor_bando_custo || 0);
              const valorTrilho = parseFloat(produto.valor_trilho || 0);
              let custoTrilho = valorTrilho * 0.6; // Estimativa: custo é 60% do valor
              const valorInstalacao = parseFloat(produto.valor_instalacao || 0);
              
              // Calcular custo do produto
              let custoProduto = 0;
              
              // Determinar o custo unitário (por m²) corretamente
              if (produtoCatalogo) {
                if (produtoCatalogo.modelo?.toUpperCase() === 'SCREEN' || 
                    produtoCatalogo.nome?.toUpperCase().includes('SCREEN') || 
                    produtoCatalogo.metodo_calculo === 'area') {
                  // Para produtos de área (como SCREEN), preco_custo já é o custo por m²
                  const custoM2 = parseFloat(produtoCatalogo.preco_custo) || 0;
                  custoProduto = largura * altura * custoM2;
                  console.log(`SCREEN: Custo por m² = R$ ${custoM2.toFixed(2)}, Área = ${(largura * altura).toFixed(2)}m², Total = R$ ${custoProduto.toFixed(2)}`);
                } else if (produtoCatalogo.modelo?.toUpperCase() === 'WAVE' && produtoCatalogo.wave_pricing) {
                  // Find the correct height tier
                  const heightValue = parseFloat(altura) || 0;
                  let priceTier = null;
                  
                  for (const tier of produtoCatalogo.wave_pricing) {
                    if (heightValue >= parseFloat(tier.min_height) && 
                        heightValue <= parseFloat(tier.max_height)) {
                      priceTier = tier;
                      break;
                    }
                  }
                  
                  // If we found a tier, use it to calculate price based on width
                  if (priceTier) {
                    const basePrice = parseFloat(priceTier.price) || 0;
                    custoProduto = basePrice * largura;
                    console.log(`Custo Wave calculado: ${custoProduto} = ${basePrice} * ${largura}`);
                  } else if (produtoCatalogo.wave_pricing.length > 0) {
                    // Fallback to first tier if no match found
                    const basePrice = parseFloat(produtoCatalogo.wave_pricing[0].price) || 0;
                    custoProduto = basePrice * largura;
                    console.log(`Custo Wave (fallback) calculado: ${custoProduto} = ${basePrice} * ${largura}`);
                  }
                } else if (produtoCatalogo.metodo_calculo === 'linear') {
                  // For linear calculation, use perimeter
                  const costPrice = parseFloat(produtoCatalogo.preco_custo) || 0;
                  custoProduto = (largura + altura) * 2 * costPrice;
                  console.log(`Custo linear calculado: ${custoProduto} = (${largura} + ${altura}) * 2 * ${costPrice}`);
                } else if (produtoCatalogo.metodo_calculo === 'altura') {
                  // For height-based products (non-Wave)
                  const costPrice = parseFloat(produtoCatalogo.preco_custo) || 0;
                  custoProduto = altura * costPrice;
                  console.log(`Custo altura calculado: ${custoProduto} = ${altura} * ${costPrice}`);
                } else {
                  // Default unit calculation
                  const costPrice = parseFloat(produtoCatalogo.preco_custo) || 0;
                  custoProduto = costPrice;
                  console.log(`Custo unitário calculado: ${custoProduto} = ${costPrice}`);
                }
              } else {
                // Se não encontrar o produto, estimar custo como 60% do valor
                custoProduto = subtotal * 0.6;
              }
              
              // Calcular custos de bandô e trilho (da mesma forma que a versão anterior)
              // Buscar dados de configuração para bandô e trilho
              try {
                // Get rail pricing from database if available
                const { data: railPricing } = supabase
                  .from('rail_pricing')
                  .select('*');
                
                if (railPricing && produto.trilho_tipo) {
                  const railData = railPricing.find(rail => rail.rail_type === produto.trilho_tipo);
                  if (railData) {
                    custoTrilho = largura * (parseFloat(railData.cost_price) || 0);
                    console.log(`Custo trilho calculado do banco: ${custoTrilho} = ${largura} * ${railData.cost_price}`);
                  }
                }
                
                // Get band pricing from configurations if available
                const { data: configData } = supabase
                  .from('configuracoes')
                  .select('*')
                  .single();
                
                if (configData && produto.bando) {
                  custoBando = largura * (parseFloat(configData.bando_custo) || 0);
                  console.log(`Custo bandô calculado do banco: ${custoBando} = ${largura} * ${configData.bando_custo}`);
                }
              } catch (error) {
                console.error('Erro ao buscar preços de bandô/trilho:', error);
                // Keep fallback values from above
              }
              
              // Valores totais
              const custoTotal = custoProduto + custoBando + custoTrilho;
              const valorTotal = subtotal + valorBando + valorTrilho;
              const lucro = valorTotal - custoTotal;
              const margemLucro = valorTotal > 0 ? (lucro / valorTotal) * 100 : 0;
              
              return {
                ...produto,
                nome: produtoCatalogo?.nome || 'Produto não identificado',
                area,
                dimensoes: { largura, altura, area },
                custos: {
                  produto: custoProduto,
                  bando: custoBando,
                  trilho: custoTrilho,
                  total: custoTotal
                },
                valores: {
                  produto: subtotal,
                  bando: valorBando,
                  trilho: valorTrilho,
                  instalacao: valorInstalacao,
                  total: valorTotal
                },
                lucro,
                margemLucro
              };
            } catch (err) {
              console.error('Erro ao processar produto:', err);
              return null;
            }
          }).filter(produto => produto !== null);
          
          // Encontrar cliente
          const cliente = clientes.find(c => c.id === orcamento.cliente_id);
          
          // Calcular totais do orçamento
          const custoTotal = produtosProcessados.reduce((sum, p) => sum + p.custos.total, 0);
          const valorTotal = parseFloat(orcamento.valor_total || 0);
          const valorInstalacaoTotal = produtosProcessados.reduce((sum, p) => sum + p.valores.instalacao, 0);
          const lucro = valorTotal - custoTotal;
          const margemLucro = valorTotal > 0 ? (lucro / valorTotal) * 100 : 0;
          
          return {
            ...orcamento,
            cliente,
            clienteNome: cliente?.nome || cliente?.name || 'Cliente não identificado',
            produtosProcessados,
            custoTotal,
            valorTotal,
            valorInstalacaoTotal,
            lucro,
            margemLucro,
            // Data formatada para melhor agrupamento
            data: new Date(orcamento.created_at),
            mes: new Date(orcamento.created_at).toLocaleString('pt-BR', { month: 'short', year: 'numeric' })
          };
        } catch (err) {
          console.error('Erro ao processar orçamento:', err);
          return null;
        }
      }).filter(orcamento => orcamento !== null);
      
      // --- CÁLCULO DO DRE ---
      // Dados para DRE
      const totalReceitas = orcamentosProcessados.reduce((sum, o) => sum + o.valorTotal, 0);
      const totalCustosProdutos = orcamentosProcessados.reduce((sum, o) => 
        sum + o.produtosProcessados.reduce((s, p) => s + p.custos.produto, 0), 0);
      const totalCustosMateriais = orcamentosProcessados.reduce((sum, o) => 
        sum + o.produtosProcessados.reduce((s, p) => s + p.custos.bando + p.custos.trilho, 0), 0);
      const totalCustosInstalacao = orcamentosProcessados.reduce((sum, o) => sum + o.valorInstalacaoTotal * 0.5, 0); // Estimativa: custo de instalação é 50% do valor
      
      // Estimativas para completar o DRE
      const custosTotais = totalCustosProdutos + totalCustosMateriais + totalCustosInstalacao;
      const custosOperacionais = 0; // Estimativa: 0% da receita
      const despesasComerciais = 0; // Estimativa: 0% da receita
      const despesasAdministrativas = 0; // Estimativa: 0% da receita
      
      const lucroOperacional = totalReceitas - custosTotais - custosOperacionais - despesasComerciais - despesasAdministrativas;
      const margemOperacional = totalReceitas > 0 ? (lucroOperacional / totalReceitas) * 100 : 0;
      
      // --- ANÁLISE DE MÉTRICAS ---
      // Métricas de negócio
      const ticketMedio = orcamentosProcessados.length > 0 ? totalReceitas / orcamentosProcessados.length : 0;
      const margemMedia = orcamentosProcessados.length > 0 ? 
        orcamentosProcessados.reduce((sum, o) => sum + o.margemLucro, 0) / orcamentosProcessados.length : 0;
        
      // Taxa de conversão (suposição: 50% para demonstração)
      const taxaConversao = 50;
      
      // Produtos mais vendidos
      const produtosContagem = {};
      orcamentosProcessados.forEach(orcamento => {
        orcamento.produtosProcessados.forEach(produto => {
          const produtoId = produto.produto_id;
          const produtoNome = produto.nome;
          
          if (!produtosContagem[produtoId]) {
            produtosContagem[produtoId] = {
              id: produtoId,
              nome: produtoNome,
              quantidade: 0,
              valorTotal: 0
            };
          }
          
          produtosContagem[produtoId].quantidade += 1;
          produtosContagem[produtoId].valorTotal += produto.valores.total;
        });
      });
      
      const produtosMaisVendidos = Object.values(produtosContagem)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
      
      // --- GRÁFICOS ---
      // Dados para gráficos
      // 1. Receita Mensal
      const mesesMap = {};
      orcamentosProcessados.forEach(orcamento => {
        try {
          const date = new Date(orcamento.created_at);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          
          if (!mesesMap[monthKey]) {
            mesesMap[monthKey] = {
              label: `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear()}`,
              receita: 0
            };
          }
          
          mesesMap[monthKey].receita += orcamento.valorTotal || 0;
        } catch (e) {
          console.error('Erro ao processar data para gráfico mensal:', e);
        }
      });
      
      const mesesOrdenados = Object.keys(mesesMap)
        .sort()
        .map(key => mesesMap[key]);
      
      const receitaMensalData = {
        labels: mesesOrdenados.map(mes => mes.label),
        datasets: [
          {
            label: 'Receita Mensal',
            data: mesesOrdenados.map(mes => mes.receita),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1,
            fill: true,
          }
        ]
      };
      
      // 2. Receita vs Custo
      const custoReceitaMesesMap = {};
      orcamentosProcessados.forEach(orcamento => {
        try {
          const date = new Date(orcamento.created_at);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          
          if (!custoReceitaMesesMap[monthKey]) {
            custoReceitaMesesMap[monthKey] = {
              label: `${date.toLocaleString('pt-BR', { month: 'short' })}/${date.getFullYear()}`,
              receita: 0,
              custo: 0
            };
          }
          
          custoReceitaMesesMap[monthKey].receita += orcamento.valorTotal || 0;
          custoReceitaMesesMap[monthKey].custo += orcamento.custoTotal || 0;
        } catch (e) {
          console.error('Erro ao processar data para gráfico de receita vs custo:', e);
        }
      });
      
      const custoReceitaMesesOrdenados = Object.keys(custoReceitaMesesMap)
        .sort()
        .map(key => custoReceitaMesesMap[key]);
      
      const receitaVsCustoData = {
        labels: custoReceitaMesesOrdenados.map(mes => mes.label),
        datasets: [
          {
            label: 'Receita',
            data: custoReceitaMesesOrdenados.map(mes => mes.receita),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 1,
          },
          {
            label: 'Custo',
            data: custoReceitaMesesOrdenados.map(mes => mes.custo),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 1,
          }
        ]
      };
      
      // 3. Margem por produto
      const produtosMargem = Object.values(produtosContagem)
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, 5);
      
      const margemPorProdutoData = {
        labels: produtosMargem.map(produto => produto.nome),
        datasets: [
          {
            label: 'Valor Total',
            data: produtosMargem.map(produto => produto.valorTotal),
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',
              'rgba(255, 99, 132, 0.5)',
              'rgba(255, 206, 86, 0.5)',
              'rgba(75, 192, 192, 0.5)',
              'rgba(153, 102, 255, 0.5)'
            ],
            borderColor: [
              'rgb(54, 162, 235)',
              'rgb(255, 99, 132)',
              'rgb(255, 206, 86)',
              'rgb(75, 192, 192)',
              'rgb(153, 102, 255)'
            ],
            borderWidth: 1,
          }
        ]
      };
      
      // 4. Distribuição de vendas por status
      const statusContagem = {};
      orcamentosProcessados.forEach(orcamento => {
        const status = orcamento.status || 'pendente';
        
        if (!statusContagem[status]) {
          statusContagem[status] = {
            quantidade: 0,
            valor: 0
          };
        }
        
        statusContagem[status].quantidade += 1;
        statusContagem[status].valor += orcamento.valorTotal || 0;
      });
      
      const distribuicaoVendasData = {
        labels: Object.keys(statusContagem).map(status => {
          // Traduzir status
          if (status === 'finalizado') return 'Finalizado';
          if (status === 'pendente' || status === 'pending') return 'Pendente';
          if (status === 'cancelado') return 'Cancelado';
          return status;
        }),
        datasets: [
          {
            label: 'Valor por Status',
            data: Object.values(statusContagem).map(s => s.valor),
            backgroundColor: [
              'rgba(75, 192, 192, 0.5)',  // Finalizado
              'rgba(255, 206, 86, 0.5)',  // Pendente
              'rgba(255, 99, 132, 0.5)',  // Cancelado
              'rgba(153, 102, 255, 0.5)'  // Outros
            ],
            borderColor: [
              'rgb(75, 192, 192)',
              'rgb(255, 206, 86)',
              'rgb(255, 99, 132)',
              'rgb(153, 102, 255)'
            ],
            borderWidth: 1,
          }
        ]
      };
      
      // Atualizar estado com todos os dados processados
      setFinancialData({
        dre: {
          receitas: totalReceitas,
          custosProdutos: totalCustosProdutos,
          custosMateriais: totalCustosMateriais,
          custosInstalacao: totalCustosInstalacao,
          custosOperacionais,
          despesasComerciais,
          despesasAdministrativas,
          lucroOperacional,
          margem: margemOperacional
        },
        fluxoCaixa: mesesOrdenados.map(mes => ({
          periodo: mes.label,
          receita: mes.receita,
          // Estimativas de fluxo de caixa
          despesas: mes.receita * 0.6,
          saldo: mes.receita * 0.4
        })),
        analiseOrcamentos: orcamentosProcessados,
        metricas: {
          ticketMedio,
          taxaConversao,
          totalVendas: orcamentosProcessados.length,
          margemMedia,
          produtosMaisVendidos
        },
        graficos: {
          receitaMensal: receitaMensalData,
          receitaVsCusto: receitaVsCustoData,
          margemPorProduto: margemPorProdutoData,
          distribuicaoVendas: distribuicaoVendasData
        }
      });
      
    } catch (err) {
      console.error('Erro ao processar dados financeiros:', err);
      // Em caso de erro, inicializar com dados vazios
      setFinancialData({
        dre: {
          receitas: 0,
          custosProdutos: 0,
          custosMateriais: 0,
          custosInstalacao: 0,
          custosOperacionais: 0,
          despesasComerciais: 0,
          despesasAdministrativas: 0,
          lucroOperacional: 0,
          margem: 0
        },
        fluxoCaixa: [],
        analiseOrcamentos: [],
        metricas: {
          ticketMedio: 0,
          taxaConversao: 0,
          totalVendas: 0,
          margemMedia: 0,
          produtosMaisVendidos: []
        },
        graficos: {
          receitaMensal: { labels: [], datasets: [] },
          receitaVsCusto: { labels: [], datasets: [] },
          margemPorProduto: { labels: [], datasets: [] },
          distribuicaoVendas: { labels: [], datasets: [] }
        }
      });
    }
  }, [orcamentos, produtos, clientes, filterOptions]);

  // Função auxiliar para renderização segura de gráficos
  const renderCharts = (chartData, options, ChartComponent, title) => {
    return (
      <div className="chart-container">
        <h3>{title}</h3>
        {(() => {
          if (!chartData || !chartData.labels || !chartData.datasets) {
            return (
              <div className="empty-chart">
                <p>Sem dados disponíveis para exibição</p>
              </div>
            );
          }

          if (!Array.isArray(chartData.labels) || chartData.labels.length === 0) {
            return (
              <div className="empty-chart">
                <p>Dados insuficientes para gerar o gráfico</p>
              </div>
            );
          }

          try {
            // Verificar cada dataset para garantir que possui dados válidos
            const validDatasets = chartData.datasets.filter(
              dataset => dataset && Array.isArray(dataset.data) && dataset.data.length > 0
            );

            if (validDatasets.length === 0) {
              return (
                <div className="empty-chart">
                  <p>Nenhum dado válido para exibição</p>
                </div>
              );
            }

            // Apenas renderizar o gráfico se todas as validações passarem
            return (
              <ChartComponent 
                data={{
                  ...chartData,
                  datasets: validDatasets
                }} 
                options={options}
              />
            );
          } catch (error) {
            console.error("Erro ao renderizar gráfico:", error);
            return (
              <div className="error-chart">
                <p>Erro ao gerar o gráfico</p>
              </div>
            );
          }
        })()}
      </div>
    );
  };

  // Efeito para carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  // Efeito para processar dados quando os orçamentos, produtos ou clientes são carregados
  useEffect(() => {
    if (!loading && orcamentos.length > 0) {
      try {
        applyFilters();
        processFinancialData();
      } catch (err) {
        console.error("Erro ao processar dados iniciais:", err);
        setError("Ocorreu um erro ao processar os dados financeiros. Por favor, tente novamente.");
      }
    }
  }, [loading, orcamentos, produtos, clientes]);

  // Efeito para aplicar filtros
  useEffect(() => {
    if (!loading && orcamentos.length > 0) {
      try {
        applyFilters();
      } catch (err) {
        console.error("Erro ao aplicar filtros:", err);
      }
    }
  }, [filterOptions]);

  // Função para exibir os detalhes de custo de um orçamento
  const mostrarDetalhamentoCustos = (orcamento) => {
    try {
      console.log('Processando detalhamento para orçamento:', orcamento);
      
      // Verificar e parsear o campo produtos_json
      let itens = [];
      
      if (orcamento.produtos_json) {
        try {
          // Tentar parsear o JSON dos produtos
          itens = JSON.parse(orcamento.produtos_json);
          console.log('Produtos encontrados no JSON:', itens);
        } catch (err) {
          console.error('Erro ao parsear produtos_json:', err);
          setError('Formato inválido nos dados do orçamento.');
          return;
        }
      } else if (orcamento.produtosProcessados && Array.isArray(orcamento.produtosProcessados)) {
        // Usar produtos já processados se disponíveis
        itens = orcamento.produtosProcessados;
        console.log('Usando produtos já processados:', itens);
      } else if (orcamento.itens && Array.isArray(orcamento.itens)) {
        // Fallback para o campo itens (caso exista)
        itens = orcamento.itens;
        console.log('Usando campo itens:', itens);
      }
      
      // Verificar se temos itens para processar
      if (!itens || !Array.isArray(itens) || itens.length === 0) {
        console.error('Orçamento sem itens após processamento:', orcamento);
        setError('Este orçamento não possui itens para detalhar.');
        return;
      }

      // Buscar informações detalhadas dos produtos para este orçamento
      const itensDetalhados = itens.map(item => {
        // Determinar o ID do produto
        const produtoId = item.produto_id;
        
        if (!produtoId) {
          console.warn('Item sem produto_id:', item);
          return {
            ...item,
            nome: item.nome || 'Produto sem identificação',
            descricao: '',
            custo_unitario: item.custos?.total / item.area || 0,
            custo_total: item.custos?.total || 0,
            preco_venda: item.subtotal / item.area || item.subtotal || 0,
            quantidade: item.area || 1,
            valor_total: item.subtotal || 0,
            margem: (item.subtotal || 0) - (item.custos?.total || 0),
            margem_percentual: item.margemLucro || 0
          };
        }
        
        // Encontrar o produto correspondente
        const produto = produtos.find(p => String(p.id) === String(produtoId));
        
        if (!produto) {
          console.warn('Produto não encontrado para o id:', produtoId);
          // Usar dados já calculados no item se disponíveis
          if (item.custos && item.valores) {
            return {
              ...item,
              nome: item.nome || 'Produto não encontrado',
              descricao: '',
              custo_unitario: item.custos.total / item.area || 0,
              custo_total: item.custos.total || 0,
              preco_venda: item.subtotal / item.area || 0,
              quantidade: item.area || 1,
              valor_total: item.subtotal || 0,
              margem: (item.subtotal || 0) - (item.custos.total || 0),
              margem_percentual: item.margemLucro ? item.margemLucro.toFixed(2) : 0
            };
          }
          
          return {
            ...item,
            nome: 'Produto não encontrado',
            descricao: '',
            custo_unitario: 0,
            custo_total: 0,
            preco_venda: item.subtotal || 0,
            quantidade: 1,
            valor_total: item.subtotal || 0,
            margem: item.subtotal || 0,
            margem_percentual: 100
          };
        }
        
        // Calcular custos e margens
        const area = item.area || (item.largura * item.altura) || 1;
        
        // Determinar o custo unitário (por m²) corretamente para diferentes tipos de produtos
        let custoUnitario = 0;
        let custoTotal = 0;
        
        if (produto.modelo?.toUpperCase() === 'SCREEN' || 
            produto.nome?.toUpperCase().includes('SCREEN') || 
            produto.metodo_calculo === 'area') {
            
          // Para produtos de área (como SCREEN), o campo preco_custo JÁ CONTÉM o custo por m²
          // Por exemplo, SCREEN 1% tem um custo de R$ 109,89 por m²
          custoUnitario = parseFloat(produto.preco_custo) || 0;
          custoTotal = custoUnitario * area; // Área × Custo por m²
          console.log(`[Detalhamento] SCREEN: Custo por m² = R$ ${custoUnitario.toFixed(2)}, Área = ${area.toFixed(2)}m², Total = R$ ${custoTotal.toFixed(2)}`);
        } else {
          // Para outros tipos de produtos, usar a lógica existente
          if (item.custos && item.custos.total) {
            // Se já temos custos calculados no item, usar
            custoTotal = item.custos.total;
            custoUnitario = area > 0 ? custoTotal / area : custoTotal;
          } else {
            // Caso contrário, usar o preço de custo do catálogo
            custoTotal = parseFloat(produto.preco_custo) || 0;
            custoUnitario = area > 0 ? custoTotal / area : custoTotal;
          }
          console.log(`[Detalhamento] Custo unitário: ${custoUnitario} (total: ${custoTotal})`);
        }
        
        const precoVenda = item.subtotal / area || 0;
        const valorTotal = item.subtotal || 0;
        const margem = valorTotal - custoTotal;
        const margemPercentual = valorTotal > 0 ? (margem / valorTotal) * 100 : 0;
        
        return {
          ...item,
          nome: produto.nome || 'Sem nome',
          descricao: produto.descricao || '',
          area: area,
          custo_unitario: custoUnitario,
          custo_total: custoTotal,
          preco_venda: precoVenda,
          quantidade: area,
          valor_total: valorTotal,
          margem: margem,
          margem_percentual: margemPercentual.toFixed(2)
        };
      });
      
      // Atualizar o estado com os detalhes do orçamento
      setOrcamentoDetalhado({
        ...orcamento,
        itens_detalhados: itensDetalhados,
        cliente: orcamento.clienteNome || clientes.find(c => String(c.id) === String(orcamento.cliente_id))?.nome || 'Cliente não encontrado'
      });
      
      // Mostrar o modal/painel de detalhamento
      setDetalhamentoVisivel(true);
    } catch (err) {
      console.error('Erro ao processar detalhamento de custos:', err);
      setError('Ocorreu um erro ao processar o detalhamento de custos.');
    }
  };

  // Função para fechar o detalhamento
  const fecharDetalhamento = () => {
    setDetalhamentoVisivel(false);
    setOrcamentoDetalhado(null);
  };

  // Formatação de moeda
  const formatCurrency = useCallback((value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }, []);

  // Formatação de percentual
  const formatPercentage = useCallback((value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0,00%';
    }
    return `${value.toFixed(2)}%`.replace('.', ',');
  }, []);

  // Renderização do componente
  return (
    <div className="financial-reports">
      <h1>Relatórios Financeiros</h1>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Tentar Novamente</button>
        </div>
      )}
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando dados financeiros...</p>
        </div>
      ) : (
        <div className="reports-content">
          {/* Filtros */}
          <div className="filter-section">
            <h2>Filtros</h2>
            <div className="filter-controls">
              <div className="filter-group">
                <label>Período:</label>
                <select 
                  value={filterOptions.period}
                  onChange={(e) => setFilterOptions({...filterOptions, period: e.target.value})}
                >
                  <option value="daily">Hoje</option>
                  <option value="weekly">Última Semana</option>
                  <option value="monthly">Último Mês</option>
                  <option value="yearly">Último Ano</option>
                  <option value="custom">Personalizado</option>
                  <option value="all">Todos</option>
                </select>
              </div>
              
              {filterOptions.period === 'custom' && (
                <div className="date-filters">
                  <div className="filter-group">
                    <label>De:</label>
                    <input 
                      type="date" 
                      value={filterOptions.startDate}
                      onChange={(e) => setFilterOptions({...filterOptions, startDate: e.target.value})}
                    />
                  </div>
                  <div className="filter-group">
                    <label>Até:</label>
                    <input 
                      type="date" 
                      value={filterOptions.endDate}
                      onChange={(e) => setFilterOptions({...filterOptions, endDate: e.target.value})}
                    />
                  </div>
                </div>
              )}
              
              <div className="filter-group">
                <label>Status:</label>
                <select 
                  value={filterOptions.status}
                  onChange={(e) => setFilterOptions({...filterOptions, status: e.target.value})}
                >
                  <option value="all">Todos</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Cliente:</label>
                <select 
                  value={filterOptions.cliente}
                  onChange={(e) => setFilterOptions({...filterOptions, cliente: e.target.value})}
                >
                  <option value="all">Todos</option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome || cliente.name || 'Cliente ' + cliente.id}
                    </option>
                  ))}
                </select>
              </div>
              
              <button 
                className="apply-filter-btn"
                onClick={() => processFinancialData()}
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
          
          {/* Métricas Resumidas */}
          <div className="metrics-cards">
            <div className="metric-card">
              <h3>Receita Total</h3>
              <div className="metric-value">{formatCurrency(financialData.dre.receitas)}</div>
            </div>
            
            <div className="metric-card">
              <h3>Lucro Operacional</h3>
              <div className="metric-value">{formatCurrency(financialData.dre.lucroOperacional)}</div>
            </div>
            
            <div className="metric-card">
              <h3>Margem</h3>
              <div className="metric-value">{formatPercentage(financialData.dre.margem)}</div>
            </div>
            
            <div className="metric-card">
              <h3>Ticket Médio</h3>
              <div className="metric-value">{formatCurrency(financialData.metricas.ticketMedio)}</div>
            </div>
            
            <div className="metric-card">
              <h3>Total de Vendas</h3>
              <div className="metric-value">{financialData.metricas.totalVendas}</div>
            </div>
          </div>
          
          {/* Abas de Relatórios */}
          <div className="report-tabs">
            <div className="tab-headers">
              <button 
                className={activeTab === 'resumo' ? 'active' : ''} 
                onClick={() => setActiveTab('resumo')}
              >
                Dashboard
              </button>
              <button 
                className={activeTab === 'dre' ? 'active' : ''} 
                onClick={() => setActiveTab('dre')}
              >
                DRE
              </button>
              <button 
                className={activeTab === 'orcamentos' ? 'active' : ''} 
                onClick={() => setActiveTab('orcamentos')}
              >
                Orçamentos
              </button>
              <button 
                className={activeTab === 'produtos' ? 'active' : ''} 
                onClick={() => setActiveTab('produtos')}
              >
                Produtos
              </button>
              <button 
                className={activeTab === 'fluxo' ? 'active' : ''} 
                onClick={() => setActiveTab('fluxo')}
              >
                Fluxo de Caixa
              </button>
            </div>
            
            <div className="tab-content">
              {/* Dashboard / Resumo */}
              {activeTab === 'resumo' && (
                <div className="dashboard-tab">
                  <div className="charts-row">
                    {renderCharts(financialData.graficos.receitaMensal, { 
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: (value) => formatCurrency(value)
                          }
                        }
                      },
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                          }
                        }
                      }
                    }, Line, "Receita Mensal")}
                    
                    {renderCharts(financialData.graficos.receitaVsCusto, { 
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: (value) => formatCurrency(value)
                          }
                        }
                      },
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                          }
                        }
                      }
                    }, Bar, "Receita vs Custo")}
                  </div>
                  
                  <div className="charts-row">
                    {renderCharts(financialData.graficos.margemPorProduto, { 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                          }
                        }
                      }
                    }, Pie, "Top Produtos")}
                    
                    {renderCharts(financialData.graficos.distribuicaoVendas, { 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                          }
                        }
                      }
                    }, Doughnut, "Distribuição por Status")}
                  </div>
                </div>
              )}
              
              {/* DRE */}
              {activeTab === 'dre' && (
                <div className="dre-tab">
                  <h2>Demonstração do Resultado do Exercício</h2>
                  <div className="dre-table">
                    <div className="dre-row header">
                      <div className="dre-cell">Descrição</div>
                      <div className="dre-cell">Valor</div>
                      <div className="dre-cell">%</div>
                    </div>
                    
                    <div className="dre-row section-header">
                      <div className="dre-cell">RECEITA OPERACIONAL BRUTA</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.receitas)}</div>
                      <div className="dre-cell">100%</div>
                    </div>
                    
                    <div className="dre-row section-header">
                      <div className="dre-cell">CUSTOS</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.custosProdutos + financialData.dre.custosMateriais + financialData.dre.custosInstalacao)}</div>
                      <div className="dre-cell">
                        {formatPercentage((financialData.dre.custosProdutos + financialData.dre.custosMateriais + financialData.dre.custosInstalacao) / financialData.dre.receitas * 100)}
                      </div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Custos dos Produtos</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.custosProdutos)}</div>
                      <div className="dre-cell">
                        {formatPercentage(financialData.dre.custosProdutos / financialData.dre.receitas * 100)}
                      </div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Custos de Materiais</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.custosMateriais)}</div>
                      <div className="dre-cell">
                        {formatPercentage(financialData.dre.custosMateriais / financialData.dre.receitas * 100)}
                      </div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Custos de Instalação</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.custosInstalacao)}</div>
                      <div className="dre-cell">
                        {formatPercentage(financialData.dre.custosInstalacao / financialData.dre.receitas * 100)}
                      </div>
                    </div>
                    
                    <div className="dre-row result">
                      <div className="dre-cell">LUCRO BRUTO</div>
                      <div className="dre-cell">
                        {formatCurrency(financialData.dre.receitas - (financialData.dre.custosProdutos + financialData.dre.custosMateriais + financialData.dre.custosInstalacao))}
                      </div>
                      <div className="dre-cell">
                        {formatPercentage((financialData.dre.receitas - (financialData.dre.custosProdutos + financialData.dre.custosMateriais + financialData.dre.custosInstalacao)) / financialData.dre.receitas * 100)}
                      </div>
                    </div>
                    
                    <div className="dre-row section-header">
                      <div className="dre-cell">DESPESAS OPERACIONAIS</div>
                      <div className="dre-cell">{formatCurrency(0)}</div>
                      <div className="dre-cell">{formatPercentage(0)}</div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Custos Operacionais</div>
                      <div className="dre-cell">{formatCurrency(0)}</div>
                      <div className="dre-cell">{formatPercentage(0)}</div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Despesas Comerciais</div>
                      <div className="dre-cell">{formatCurrency(0)}</div>
                      <div className="dre-cell">{formatPercentage(0)}</div>
                    </div>
                    
                    <div className="dre-row">
                      <div className="dre-cell">Despesas Administrativas</div>
                      <div className="dre-cell">{formatCurrency(0)}</div>
                      <div className="dre-cell">{formatPercentage(0)}</div>
                    </div>
                    
                    <div className="dre-row final-result">
                      <div className="dre-cell">RESULTADO OPERACIONAL LÍQUIDO</div>
                      <div className="dre-cell">{formatCurrency(financialData.dre.lucroOperacional)}</div>
                      <div className="dre-cell">{formatPercentage(financialData.dre.margem)}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Orçamentos */}
              {activeTab === 'orcamentos' && (
                <div className="orcamentos-tab">
                  <h2>Análise Detalhada de Orçamentos</h2>
                  
                  {financialData.analiseOrcamentos.length > 0 ? (
                    <div className="table-container">
                      <table className="orcamentos-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Cliente</th>
                            <th>Data</th>
                            <th>Valor Total</th>
                            <th>Custo Total</th>
                            <th>Lucro</th>
                            <th>Margem</th>
                            <th>Status</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialData.analiseOrcamentos.map(orcamento => (
                            <tr key={orcamento.id}>
                              <td>{orcamento.id}</td>
                              <td>{orcamento.clienteNome}</td>
                              <td>{new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</td>
                              <td>{formatCurrency(orcamento.valorTotal)}</td>
                              <td>{formatCurrency(orcamento.custoTotal)}</td>
                              <td>{formatCurrency(orcamento.lucro)}</td>
                              <td>{formatPercentage(orcamento.margemLucro)}</td>
                              <td>
                                <span className={`status-badge status-${orcamento.status || 'pendente'}`}>
                                  {orcamento.status === 'finalizado' ? 'Finalizado' : 
                                   orcamento.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                                </span>
                              </td>
                              <td>
                                <button 
                                  className="detalhamento-btn"
                                  onClick={() => mostrarDetalhamentoCustos(orcamento)}
                                >
                                  <FaInfoCircle /> Detalhamento
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="3">Total</td>
                            <td>{formatCurrency(financialData.dre.receitas)}</td>
                            <td>{formatCurrency(financialData.dre.custosProdutos + financialData.dre.custosMateriais + financialData.dre.custosInstalacao)}</td>
                            <td>{formatCurrency(financialData.dre.lucroOperacional)}</td>
                            <td>{formatPercentage(financialData.dre.margem)}</td>
                            <td></td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="no-data-message">
                      <p>Nenhum orçamento encontrado no período selecionado.</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Produtos */}
              {activeTab === 'produtos' && (
                <div className="produtos-tab">
                  <h2>Análise de Produtos</h2>
                  
                  {financialData.metricas.produtosMaisVendidos?.length > 0 ? (
                    <>
                      <div className="table-container">
                        <table className="produtos-table">
                          <thead>
                            <tr>
                              <th>Produto</th>
                              <th>Quantidade</th>
                              <th>Valor Total</th>
                              <th>% das Vendas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialData.metricas.produtosMaisVendidos.map(produto => (
                              <tr key={produto.id}>
                                <td>{produto.nome}</td>
                                <td>{produto.quantidade}</td>
                                <td>{formatCurrency(produto.valorTotal)}</td>
                                <td>
                                  {formatPercentage(produto.valorTotal / financialData.dre.receitas * 100)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="chart-container product-chart">
                        <h3>Distribuição de Vendas por Produto</h3>
                        {renderCharts(financialData.graficos.margemPorProduto, { 
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const value = context.raw;
                                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                  const percentage = (value / total * 100).toFixed(2);
                                  return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                                }
                              }
                            }
                          }
                        }, Pie, "Distribuição de Vendas por Produto")}
                      </div>
                    </>
                  ) : (
                    <div className="no-data-message">
                      <p>Nenhum produto vendido no período selecionado.</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Fluxo de Caixa */}
              {activeTab === 'fluxo' && (
                <div className="fluxo-tab">
                  <h2>Fluxo de Caixa</h2>
                  
                  {financialData.fluxoCaixa?.length > 0 ? (
                    <div className="table-container">
                      <table className="fluxo-table">
                        <thead>
                          <tr>
                            <th>Período</th>
                            <th>Receitas</th>
                            <th>Despesas</th>
                            <th>Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialData.fluxoCaixa.map((periodo, index) => (
                            <tr key={index}>
                              <td>{periodo.periodo}</td>
                              <td>{formatCurrency(periodo.receita)}</td>
                              <td>{formatCurrency(periodo.despesas)}</td>
                              <td>{formatCurrency(periodo.saldo)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Total</td>
                            <td>
                              {formatCurrency(financialData.fluxoCaixa.reduce((sum, p) => sum + p.receita, 0))}
                            </td>
                            <td>
                              {formatCurrency(financialData.fluxoCaixa.reduce((sum, p) => sum + p.despesas, 0))}
                            </td>
                            <td>
                              {formatCurrency(financialData.fluxoCaixa.reduce((sum, p) => sum + p.saldo, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="no-data-message">
                      <p>Nenhum dado de fluxo de caixa disponível para o período selecionado.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {orcamentoDetalhado && detalhamentoVisivel && (
        <>
          <div className="modal-overlay" onClick={fecharDetalhamento}></div>
          <div className="detalhamento-modal">
            <div className="detalhamento-header">
              <h2>Detalhamento de Orçamento #{orcamentoDetalhado.id}</h2>
              <button 
                className="close-btn"
                onClick={fecharDetalhamento}
              >
                Fechar
              </button>
            </div>
            <div className="detalhamento-content">
              <div className="detalhamento-info">
                <p><strong>Cliente:</strong> {orcamentoDetalhado.cliente}</p>
                <p><strong>Data:</strong> {new Date(orcamentoDetalhado.created_at).toLocaleDateString('pt-BR')}</p>
                <p><strong>Status:</strong> <span className={`status-badge ${orcamentoDetalhado.status}`}>{orcamentoDetalhado.status}</span></p>
                <p><strong>Total:</strong> {formatCurrency(orcamentoDetalhado.valor_total || 0)}</p>
              </div>
              
              <h3>Detalhamento de Itens e Custos</h3>
              {orcamentoDetalhado.itens_detalhados && orcamentoDetalhado.itens_detalhados.length > 0 ? (
                <table className="detalhamento-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Dimensões (L×A)</th>
                      <th>Área (m²)</th>
                      <th>Custo/m²</th>
                      <th>Custo Total</th>
                      <th>Preço/m²</th>
                      <th>Valor Total</th>
                      <th>Margem</th>
                      <th>Margem (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orcamentoDetalhado.itens_detalhados.map((item, index) => (
                      <tr key={index}>
                        <td>{item.nome}</td>
                        <td>
                          {item.largura && item.altura 
                            ? `${item.largura.toFixed(2)}m × ${item.altura.toFixed(2)}m` 
                            : "N/A"}
                        </td>
                        <td>{item.area ? item.area.toFixed(2) : "N/A"}</td>
                        <td>{formatCurrency(item.custo_unitario)}</td>
                        <td>{formatCurrency(item.custo_total)}</td>
                        <td>{formatCurrency(item.preco_venda)}</td>
                        <td>{formatCurrency(item.valor_total)}</td>
                        <td>{formatCurrency(item.margem)}</td>
                        <td>{item.margem_percentual}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="2"><strong>Totais</strong></td>
                      <td><strong>{orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.area || 0), 0).toFixed(2)}</strong></td>
                      <td></td>
                      <td><strong>{formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.custo_total || 0), 0))}</strong></td>
                      <td></td>
                      <td><strong>{formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.valor_total || 0), 0))}</strong></td>
                      <td><strong>{formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.margem || 0), 0))}</strong></td>
                      <td>
                        <strong>
                          {(() => {
                            const totalValor = orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.valor_total || 0), 0);
                            const totalMargem = orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.margem || 0), 0);
                            return totalValor > 0 
                              ? ((totalMargem / totalValor) * 100).toFixed(2) 
                              : "0.00";
                          })()}%
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="empty-info">
                  <p>Não há itens detalhados disponíveis para este orçamento.</p>
                </div>
              )}

              <div className="detalhamento-extras">
                <h3>Informações Adicionais</h3>
                <div className="extras-grid">
                  {orcamentoDetalhado.valorInstalacaoTotal > 0 && (
                    <div className="extra-item">
                      <p><strong>Valor de Instalação:</strong> {formatCurrency(orcamentoDetalhado.valorInstalacaoTotal)}</p>
                    </div>
                  )}
                  {orcamentoDetalhado.observacao && (
                    <div className="extra-item">
                      <p><strong>Observações:</strong> {orcamentoDetalhado.observacao}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReportsNew;
