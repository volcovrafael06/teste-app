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

// Usar default de 60% do valor de venda quando o custo é desconhecido
const DEFAULT_COST_RATIO = 0.6;

// Função para processar cada item do orçamento
const processarItemOrcamento = async (itemDoJson, configuracoes) => {
  try {
    if (!itemDoJson || !itemDoJson.produto_id) {
      throw new Error('Item inválido ou sem ID de produto');
    }
    
    // Buscar o produto no banco de dados
    const { data: produtoDB, error: produtoError } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', itemDoJson.produto_id)
      .single();
    
    if (produtoError) {
      throw new Error(`Falha ao buscar produto: ${produtoError.message}`);
    }
    
    // Garantir valores numéricos seguros
    const parseFloatSafe = (valor) => {
      const parsed = parseFloat(valor);
      return isNaN(parsed) ? 0 : parsed;
    };
    
    // Criar um novo objeto para o item processado
    let itemProcessado = {
      ...itemDoJson,                          
      produto_id: itemDoJson.produto_id,
      nome: produtoDB?.nome || 'Produto não encontrado',
      largura: parseFloatSafe(itemDoJson.largura),
      altura: parseFloatSafe(itemDoJson.altura),
      area: parseFloatSafe(itemDoJson.largura) * parseFloatSafe(itemDoJson.altura),
      
      // Para BANDÔ
      bando: itemDoJson.bando || false,
      custo_bando: parseFloatSafe(itemDoJson.valor_bando_custo),
      valor_bando: parseFloatSafe(itemDoJson.valor_bando),
      
      // Para TRILHO
      trilho_tipo: itemDoJson.trilho_tipo || '',
      custo_trilho: 0, // Será calculado abaixo com base na largura
      valor_trilho: parseFloatSafe(itemDoJson.valor_trilho),
      
      // Para INSTALAÇÃO
      instalacao: itemDoJson.instalacao || false,
      valor_instalacao: parseFloatSafe(itemDoJson.valor_instalacao),
      
      // Para valores totais
      valor_total: parseFloatSafe(itemDoJson.subtotal),
      
      // Inicializando outros valores para evitar undefined
      custo_acessorios: parseFloatSafe(itemDoJson.custo_acessorios),
      custo_unitario: 0,
      custo_material: 0,
      custo_total: 0
    };
    
    // Buscar preço do trilho com base no tipo selecionado
    if (itemProcessado.trilho_tipo) {
      try {
        // Buscar informações do tipo de trilho da tabela configuracoes
        const { data: configData, error: configError } = await supabase
          .from('configuracoes')
          .select('trilho_redondo_com_comando, trilho_redondo_sem_comando, trilho_slim_com_comando, trilho_slim_sem_comando, trilho_quadrado_com_rodizio_em_gancho, trilho_motorizado')
          .single();
          
        if (!configError && configData) {
          // Mapear o tipo de trilho para a coluna correta
          const railTypeMap = {
            'trilho_redondo_com_comando': 'trilho_redondo_com_comando',
            'trilho_redondo_sem_comando': 'trilho_redondo_sem_comando',
            'trilho_slim_com_comando': 'trilho_slim_com_comando',
            'trilho_slim_sem_comando': 'trilho_slim_sem_comando',
            'trilho_quadrado_com_rodizio_em_gancho': 'trilho_quadrado_com_rodizio_em_gancho',
            'trilho_motorizado': 'trilho_motorizado'
          };
          
          const configKey = railTypeMap[itemProcessado.trilho_tipo];
          
          if (configKey && configData[configKey] !== undefined) {
            // Obter valores do trilho
            const precoVendaUnitario = parseFloatSafe(configData[configKey]); 
            const largura = parseFloatSafe(itemProcessado.largura);
            
            // Calcular o valor de venda baseado na tabela se não especificado
            if (!itemProcessado.valor_trilho || itemProcessado.valor_trilho === 0) {
              itemProcessado.valor_trilho = largura * precoVendaUnitario;
            }
            
            // CORREÇÃO: Usar o valor do trilho como custo sem assumir margem
            // O custo do trilho é exatamente o mesmo que o valor de venda
            itemProcessado.custo_trilho = itemProcessado.valor_trilho;
            
            // Log para depuração
            console.log(`Trilho calculado: tipo=${itemProcessado.trilho_tipo}, largura=${largura}`);
            console.log(`Preço unitário=${precoVendaUnitario}/m, Valor total=${itemProcessado.valor_trilho}`);
            console.log(`Custo total=${itemProcessado.custo_trilho} (igual ao valor de venda)`);
          } else {
            console.warn(`Configuração não encontrada para o trilho: ${itemProcessado.trilho_tipo}`);
            // Usar valor de custo informado como fallback
            itemProcessado.custo_trilho = parseFloatSafe(itemDoJson.valor_trilho_custo || (itemDoJson.valor_trilho * 0.6));
          }
        } else {
          console.warn(`Configurações não encontradas: ${configError?.message}`);
          // Usar valor de custo informado como fallback
          itemProcessado.custo_trilho = parseFloatSafe(itemDoJson.valor_trilho_custo || (itemDoJson.valor_trilho * 0.6));
        }
      } catch (error) {
        console.error('Erro ao buscar preço do trilho:', error);
        // Usar valor de custo informado como fallback
        itemProcessado.custo_trilho = parseFloatSafe(itemDoJson.valor_trilho_custo || (itemDoJson.valor_trilho * 0.6));
      }
    } else if (itemDoJson.valor_trilho_custo || itemDoJson.valor_trilho) {
      // Se não tiver tipo mas tiver valor, usar o valor informado
      itemProcessado.custo_trilho = parseFloatSafe(itemDoJson.valor_trilho_custo || (itemDoJson.valor_trilho * 0.6));
    }
    
    // Calcular o custo unitário e material com base no tipo de produto
    if (produtoDB?.nome?.toUpperCase().includes('SCREEN')) {
      // Para produtos SCREEN
      itemProcessado.custo_unitario = parseFloatSafe(configuracoes?.screen_custo) || 109.89;
      itemProcessado.custo_material = itemProcessado.area * itemProcessado.custo_unitario;
    } 
    else if (produtoDB?.nome?.toUpperCase().includes('WAVE') || 
             produtoDB?.modelo?.toUpperCase() === 'WAVE' || 
             produtoDB?.nome?.toUpperCase().includes('COLOMBIA')) {
      // Processar produtos WAVE ou COLOMBIA
      try {
        let custoUnitario = 0;
        
        if (produtoDB.wave_pricing_data || produtoDB.pricing_data) {
          // Calcular com base na tabela de preços por altura
          let pricingData = produtoDB.wave_pricing_data || produtoDB.pricing_data;
          
          const waveData = typeof pricingData === 'string' 
            ? JSON.parse(pricingData) 
            : pricingData;
          
          // Verificar formato dos dados de pricing
          const isNewFormat = waveData && waveData.length > 0 && 'min_height' in waveData[0];
          
          if (isNewFormat) {
            // Novo formato: [{"min_height":0,"max_height":2.5,"price":"138","sale_price":"303.60"}, ...]
            // Encontrar a faixa de preço correspondente à altura do item
            const altura = parseFloatSafe(itemProcessado.altura);
            const priceTier = waveData.find(tier => 
              altura >= parseFloatSafe(tier.min_height) && 
              altura <= parseFloatSafe(tier.max_height)
            );
            
            if (priceTier) {
              custoUnitario = parseFloatSafe(priceTier.price);
              itemProcessado.preco_venda = parseFloatSafe(priceTier.sale_price);
            }
          } else {
            // Formato antigo: com campos "altura", "custo", "venda"
            const alturaArredondada = Math.ceil(itemProcessado.altura * 10) / 10;
            const precoPorAltura = waveData.find(w => parseFloatSafe(w.altura) === alturaArredondada);
            
            if (precoPorAltura) {
              custoUnitario = parseFloatSafe(precoPorAltura.custo);
              itemProcessado.preco_venda = parseFloatSafe(precoPorAltura.venda);
            }
          }
        }
        
        // Se não tiver preço específico, usar custo padrão ou calcular baseado no valor total
        if (custoUnitario <= 0) {
          // Verificar se temos o preço de custo
          if (produtoDB?.preco_custo && parseFloatSafe(produtoDB.preco_custo) > 0) {
            custoUnitario = parseFloatSafe(produtoDB.preco_custo);
          } else {
            // Calcular um custo aproximado baseado no valor total
            const valorMaterial = itemProcessado.valor_total - itemProcessado.valor_trilho - 
                                  itemProcessado.valor_instalacao - itemProcessado.valor_bando;
            
            // Custo unitário baseado em uma margem aproximada de 40%
            custoUnitario = itemProcessado.area > 0 ? (valorMaterial / itemProcessado.area) * 0.6 : 0;
          }
        }
        
        itemProcessado.custo_unitario = custoUnitario;
        itemProcessado.custo_material = itemProcessado.area * itemProcessado.custo_unitario;
      } catch (error) {
        console.error('Erro ao processar dados de WAVE/COLOMBIA:', error);
        // Manter o processamento mesmo com erro, usando valores padrão
        itemProcessado.custo_unitario = parseFloatSafe(produtoDB?.preco_custo) || 0;
        itemProcessado.custo_material = itemProcessado.area * itemProcessado.custo_unitario;
      }
    } 
    else {
      // Para outros produtos padrão
      itemProcessado.custo_unitario = parseFloatSafe(produtoDB?.preco_custo) || 0;
      itemProcessado.custo_material = itemProcessado.area * itemProcessado.custo_unitario;
      
      // Calcular preço por m²
      if (itemProcessado.area > 0) {
        const valorCortinaSemExtras = itemProcessado.valor_total - itemProcessado.valor_trilho - 
                                      itemProcessado.valor_bando - itemProcessado.valor_instalacao;
        itemProcessado.preco_venda = valorCortinaSemExtras / itemProcessado.area;
      }
    }
    
    // CÁLCULO DO CUSTO TOTAL (OBJETIVO PRINCIPAL DA CORREÇÃO)
    // Garantir que o custo total inclua todos os componentes
    const custoMaterial = parseFloatSafe(itemProcessado.custo_material);
    const custoTrilho = parseFloatSafe(itemProcessado.custo_trilho);
    const custoBando = parseFloatSafe(itemProcessado.custo_bando);
    const custoAcessorios = parseFloatSafe(itemProcessado.custo_acessorios);
    const valorInstalacao = parseFloatSafe(itemProcessado.valor_instalacao);
    
    // Calcular custo total incluindo TODOS os componentes (incluindo instalação)
    const custoTotal = custoMaterial + custoTrilho + custoBando + custoAcessorios + valorInstalacao;
    
    // Atualizar o item processado com o custo total calculado
    itemProcessado.custo_total = custoTotal;
    
    // Garantir que o custo total nunca seja zero quando há valor total
    if (itemProcessado.valor_total > 0 && itemProcessado.custo_total <= 0) {
      // Se não conseguimos calcular o custo, vamos estimar com base em uma margem padrão de 40%
      itemProcessado.custo_total = itemProcessado.valor_total * 0.6;
      
      // Distribuir o custo total entre os componentes
      if (itemProcessado.area > 0) {
        itemProcessado.custo_unitario = itemProcessado.custo_total / itemProcessado.area;
        itemProcessado.custo_material = itemProcessado.area * itemProcessado.custo_unitario;
      }
    }
    
    // Incluir o objeto do produto completo para referência
    itemProcessado.produto = produtoDB;
    
    return itemProcessado;
  } catch (error) {
    console.error('Erro ao processar item do orçamento:', error);
    throw error; // Repassar o erro para tratamento na função chamadora
  }
};

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
  const [loadingDetalhado, setLoadingDetalhado] = useState(false);

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
  const processFinancialData = useCallback(async () => {
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
            console.error(`Erro ao parsear produtos_json do orçamento ${orcamento.id}:`, error);
            produtosOrcamento = [];
          }
          
          if (!Array.isArray(produtosOrcamento)) {
            produtosOrcamento = [];
          }
          
          // Processar produtos do orçamento
          const produtosProcessados = produtosOrcamento.map(produto => processarItemOrcamento(produto, produtos, orcamento)).filter(produto => produto !== null);
          
          // Encontrar cliente
          const cliente = clientes.find(c => c.id === orcamento.cliente_id);
          
          // Calcular totais do orçamento
          const custoTotal = produtosProcessados.reduce((sum, p) => sum + p.custo_total, 0);
          const valorTotal = parseFloat(orcamento.valor_total || 0);
          const valorInstalacaoTotal = produtosProcessados.reduce((sum, p) => sum + p.valor_instalacao, 0);
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
        sum + o.produtosProcessados.reduce((s, p) => s + p.custo_material, 0), 0);
      const totalCustosMateriais = orcamentosProcessados.reduce((sum, o) => 
        sum + o.produtosProcessados.reduce((s, p) => s + p.custo_bando + p.custo_trilho, 0), 0);
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
          produtosContagem[produtoId].valorTotal += produto.valor_total;
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

  // Processar detalhamento de orçamento para modal
  const processarDetalhamento = async (orcamentoId) => {
    try {
      setLoadingDetalhado(true);
      console.log('Iniciando processamento detalhado para orçamento ID:', orcamentoId);
      
      if (!orcamentoId) {
        throw new Error('ID do orçamento não fornecido');
      }
      
      // Buscar o orçamento completo no Supabase
      const { data: orcamento, error: orcamentoError } = await supabase
        .from('orcamentos')
        .select('*, clientes(id, name)')
        .eq('id', orcamentoId)
        .single();
      
      if (orcamentoError) {
        console.error('Erro ao buscar orçamento:', orcamentoError);
        throw new Error(`Falha ao buscar orçamento: ${orcamentoError.message}`);
      }
      
      if (!orcamento) {
        throw new Error('Orçamento não encontrado');
      }
      
      console.log('Orçamento encontrado:', { id: orcamento.id, number: orcamento.numero_orcamento });
      
      // Verificar e parsear o campo produtos_json
      let itens = [];
      let acessorios = [];
      
      if (!orcamento.produtos_json) {
        throw new Error('Este orçamento não possui produtos detalhados (produtos_json vazio)');
      }
      
      // Parsear o JSON com tratamento de erros
      try {
        itens = JSON.parse(orcamento.produtos_json);
        console.log(`Encontrados ${itens.length} produtos no orçamento`);
        
        if (orcamento.acessorios_json) {
          acessorios = JSON.parse(orcamento.acessorios_json);
          console.log(`Encontrados ${acessorios.length} acessórios no orçamento`);
        }
      } catch (parseError) {
        console.error('Erro ao parsear JSON:', parseError);
        throw new Error(`Falha ao processar dados do orçamento: ${parseError.message}`);
      }
      
      // Para processamento em paralelo dos itens do orçamento com melhor tratamento de erros
      let itensProcessados = [];
      let acessoriosProcessados = [];
      
      try {
        // Buscar configurações uma vez para usar em todo o processamento
        const { data: configuracoes, error: configError } = await supabase
          .from("configuracoes")
          .select("*")
          .single();
          
        if (configError) {
          console.warn('Erro ao carregar configurações:', configError);
          // Continuar mesmo sem configurações, usando valores padrão
        }
        
        // Processar itens em paralelo com tratamento de erros em cada item
        itensProcessados = await Promise.all(
          itens.map(async (itemDoJson, index) => {
            try {
              return await processarItemOrcamento(itemDoJson, configuracoes);
            } catch (itemError) {
              console.error(`Erro ao processar item #${index}:`, itemError);
              // Retornar um objeto de erro, mas não interromper todo o processamento
              return {
                ...itemDoJson,
                nome: `Erro no item #${index}`,
                erro: itemError.message,
                custo_material: 0,
                custo_trilho: 0,
                custo_bando: 0, 
                custo_acessorios: 0,
                valor_instalacao: 0,
                custo_total: 0,
                valor_total: parseFloat(itemDoJson.subtotal || 0)
              };
            }
          })
        );
        
        // Processar acessórios em paralelo
        if (acessorios.length > 0) {
          acessoriosProcessados = await Promise.all(
            acessorios.map(async (acessorioDoJson, index) => {
              try {
                // Buscar o acessório no banco de dados
                const { data: acessorioDB, error: acessorioError } = await supabase
                  .from('produtos')
                  .select('*')
                  .eq('id', acessorioDoJson.produto_id)
                  .single();
                
                if (acessorioError) {
                  throw new Error(`Falha ao buscar dados do acessório: ${acessorioError.message}`);
                }
                
                return {
                  ...acessorioDoJson,
                  nome: acessorioDB?.nome || 'Acessório não encontrado',
                  preco: parseFloat(acessorioDB?.preco_venda) || 0,
                  custo: parseFloat(acessorioDB?.preco_custo) || 0,
                  quantidade: parseInt(acessorioDoJson.quantidade) || 1,
                  valor_total: parseInt(acessorioDoJson.quantidade || 1) * parseFloat(acessorioDB?.preco_venda || 0)
                };
              } catch (acessorioError) {
                console.error(`Erro ao processar acessório #${index}:`, acessorioError);
                return {
                  ...acessorioDoJson,
                  nome: `Erro no acessório #${index}`,
                  erro: acessorioError.message,
                  preco: 0,
                  custo: 0,
                  quantidade: 1,
                  valor_total: 0
                };
              }
            })
          );
        }
      } catch (processingError) {
        console.error('Erro durante o processamento de itens:', processingError);
        throw new Error(`Falha no processamento: ${processingError.message}`);
      }
      
      // Preparar o objeto de detalhamento com valores seguros
      const detalhamento = {
        id: orcamento.id,
        numero_orcamento: orcamento.numero_orcamento || 'SEM NÚMERO',
        cliente: orcamento.clientes?.name || 'Cliente não identificado',
        data: orcamento.created_at ? new Date(orcamento.created_at).toLocaleDateString('pt-BR') : 'Data desconhecida',
        status: orcamento.status || 'pendente',
        valor_total: parseFloat(orcamento.valor_total) || 0,
        itens_detalhados: itensProcessados || [],
        acessorios_detalhados: acessoriosProcessados || [],
        observacao: orcamento.observacao || ''
      };
      
      // Log de sucesso
      console.log('Processamento concluído com sucesso. Resumo:', {
        id: detalhamento.id,
        numero: detalhamento.numero_orcamento,
        total_itens: detalhamento.itens_detalhados.length,
        total_acessorios: detalhamento.acessorios_detalhados.length,
        valor_total: detalhamento.valor_total
      });
      
      // Atualizar o estado com o detalhamento processado
      setOrcamentoDetalhado(detalhamento);
      setDetalhamentoVisivel(true);
      setLoadingDetalhado(false);
      
    } catch (error) {
      // Log detalhado do erro
      const errorDetails = {
        message: error?.message || 'Erro desconhecido',
        stack: error?.stack,
        name: error?.name,
        code: error?.code
      };
      
      console.error('Falha no processamento de detalhamento - dados completos:', errorDetails);
      setError(`Erro: ${errorDetails.message}`);
      
      // De acordo com a memória do usuário, inicializar todos os estados para valores vazios
      setOrcamentoDetalhado({
        id: orcamentoId || 0,
        numero_orcamento: 'Erro',
        cliente: 'Erro ao carregar dados',
        data: 'N/A',
        status: 'erro',
        valor_total: 0,
        itens_detalhados: [],
        acessorios_detalhados: [],
        observacao: `Falha no processamento: ${errorDetails.message}`
      });
      
      setDetalhamentoVisivel(true);
      setLoadingDetalhado(false);
    }
  };

  // Função para exibir os detalhes de custo de um orçamento
  const mostrarDetalhamentoCustos = async (orcamento) => {
    try {
      setLoadingDetalhado(true);
      
      if (!orcamento || !orcamento.id) {
        console.error('Orçamento inválido:', orcamento);
        setError("Orçamento inválido ou sem ID");
        setLoadingDetalhado(false);
        return;
      }
      
      console.log('Iniciando processamento de detalhamento para orçamento:', orcamento.id);
      
      // Chamar nossa função aprimorada com tratamento de erros completo
      await processarDetalhamento(orcamento.id);
      
    } catch (error) {
      // Melhorar o log de erro para incluir mais informações
      const errorInfo = {
        message: error?.message || 'Erro desconhecido',
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
        toString: error?.toString()
      };
      
      console.error('Erro ao exibir detalhamento de custos - detalhes:', errorInfo);
      
      setError(`Erro ao processar detalhamento: ${errorInfo.message}`);
      setLoadingDetalhado(false);
      
      // Inicializar estados para valores vazios quando ocorrem erros (conforme memória do usuário)
      setOrcamentoDetalhado({
        id: orcamento?.id || 0,
        numero: orcamento?.numero || 'N/A',
        cliente: 'Erro ao carregar',
        data: 'N/A',
        status: 'erro',
        valor_total: 0,
        itens_detalhados: []
      });
    }
  };

  const getOrcamentoById = async (orcamentoId) => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*, clientes(id, name)')
        .eq('id', orcamentoId)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        return null;
      }
      
      // Usar a função processarDetalhamento para gerar detalhamento completo
      await processarDetalhamento(orcamentoId);
      
      return data;
    } catch (error) {
      console.error('Erro ao buscar orçamento pelo ID:', error);
      return null;
    }
  };

  // Função para formatar valores monetários com precisão de duas casas decimais
  const formatCurrency = useCallback((value) => {
    if (value === undefined || value === null) {
      return 'R$ 0,00';
    }
    
    // Garante que o valor seja tratado como número
    const numValue = Number(value);
    
    // Verifica se é um número válido
    if (isNaN(numValue)) {
      return 'R$ 0,00';
    }
    
    // Formata o número com 2 casas decimais e substitui ponto por vírgula
    return `R$ ${numValue.toFixed(2).replace('.', ',')}`;
  }, []);

  // Formatação de percentual
  const formatPercentage = useCallback((value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0,00%';
    }
    return `${value.toFixed(2)}%`.replace('.', ',');
  }, []);

  // Função para fechar o detalhamento
  const fecharDetalhamento = () => {
    setDetalhamentoVisivel(false);
    // Importante limpar o estado para evitar problemas ao abrir novamente
    setError(null);
    // Não limpamos o orcamentoDetalhado para permitir animação de saída
  };

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
                                label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
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
              <h2>Detalhamento de Orçamento #{orcamentoDetalhado?.numero_orcamento}</h2>
              <button 
                className="close-btn"
                onClick={fecharDetalhamento}
              >
                Fechar
              </button>
            </div>
            <div className="detalhamento-content">
              {loadingDetalhado ? (
                <div className="loading-container" style={{ textAlign: 'center', padding: '50px' }}>
                  <div className="spinner" style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '5px solid #f3f3f3',
                    borderTop: '5px solid #2170cf',
                    borderRadius: '50%',
                    margin: '0 auto 20px',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <p>Processando detalhamento...</p>
                </div>
              ) : (
                <div>
                  {error && <div className="error-message" style={{ color: 'red', padding: '10px', margin: '10px 0', backgroundColor: '#ffeeee', borderRadius: '4px' }}>{error}</div>}
                  
                  {orcamentoDetalhado && !error && (
                    <div>
                      <div className="detalhamento-info">
                        <p><strong>Cliente:</strong> {orcamentoDetalhado.cliente}</p>
                        <p><strong>Data:</strong> {(() => {
                          try {
                            if (!orcamentoDetalhado.data) return 'Data não disponível';
                            
                            // Verificar formato da data
                            let dataOrcamento;
                            
                            // Tentar diferentes formatos de data
                            if (typeof orcamentoDetalhado.data === 'string') {
                              // Verificar se a data está no formato ISO
                              if (orcamentoDetalhado.data.includes('T')) {
                                dataOrcamento = new Date(orcamentoDetalhado.data);
                              } else if (orcamentoDetalhado.data.includes('-')) {
                                // Formato YYYY-MM-DD
                                const [ano, mes, dia] = orcamentoDetalhado.data.split('-');
                                dataOrcamento = new Date(ano, mes - 1, dia);
                              } else if (orcamentoDetalhado.data.includes('/')) {
                                // Formato DD/MM/YYYY
                                const [dia, mes, ano] = orcamentoDetalhado.data.split('/');
                                dataOrcamento = new Date(ano, mes - 1, dia);
                              } else {
                                // Tentar converter diretamente
                                dataOrcamento = new Date(orcamentoDetalhado.data);
                              }
                            } else {
                              // Se não for string, tentar converter diretamente
                              dataOrcamento = new Date(orcamentoDetalhado.data);
                            }
                            
                            // Verificar se a data é válida
                            if (!isNaN(dataOrcamento.getTime())) {
                              // Formatar a data corretamente
                              return dataOrcamento.toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              });
                            } else {
                              return 'Data não disponível';
                            }
                          } catch (e) {
                            console.error("Erro ao formatar data:", e, orcamentoDetalhado.data);
                            return 'Data não disponível';
                          }
                        })()}</p>
                        <p><strong>Status:</strong> <span className={`status-badge ${orcamentoDetalhado.status}`}>{orcamentoDetalhado.status}</span></p>
                        <p><strong>Total:</strong> {formatCurrency(orcamentoDetalhado.valor_total || 0)}</p>
                      </div>
                      
                      <h3>Detalhamento de Itens e Custos</h3>
                      {orcamentoDetalhado.itens_detalhados && orcamentoDetalhado.itens_detalhados.length > 0 ? (
                        <div className="detalhamento-table-container">
                          <table className="detalhamento-table">
                            <thead>
                              <tr>
                                <th>Produto</th>
                                <th>Dim.</th>
                                <th>Área</th>
                                <th>Custo/m²</th>
                                <th>Custo Mat.</th>
                                <th>Trilho C/L</th>
                                <th>Bandô C/L</th>
                                <th>Acess.</th>
                                <th>Instal.</th>
                                <th>Custo Total</th>
                                <th>Valor Total</th>
                                <th>Margem</th>
                                <th>Margem %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orcamentoDetalhado.itens_detalhados.map((item, index) => {
                                return (
                                  <tr key={index}>
                                    <td title={item.nome}>{item.nome}</td>
                                    <td>
                                      {item.largura && item.altura 
                                        ? `${item.largura.toFixed(2)}×${item.altura.toFixed(2)}` 
                                        : "N/A"}
                                    </td>
                                    <td>{item.area?.toFixed(2) || "0.00"}</td>
                                    <td>{formatCurrency(item.custo_unitario || 0)}</td>
                                    <td>{formatCurrency(item.custo_material || 0)}</td>
                                    <td>
                                      {formatCurrency(item.custo_trilho || 0)}
                                    </td>
                                    <td>
                                      {formatCurrency(item.custo_bando || 0)}
                                    </td>
                                    <td>{formatCurrency(item.custo_acessorios || 0)}</td>
                                    <td>{formatCurrency(item.valor_instalacao || 0)}</td>
                                    <td>{formatCurrency(item.custo_total || 0)}</td>
                                    <td>{formatCurrency(item.valor_total || 0)}</td>
                                    <td>{formatCurrency((item.valor_total || 0) - (item.custo_total || 0))}</td>
                                    <td>
                                      {((item.valor_total > 0 
                                        ? ((item.valor_total - item.custo_total) / item.valor_total * 100) 
                                        : 0).toFixed(1))}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="2"><strong>Totais</strong></td>
                                <td>
                                  <strong>
                                    {orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.area || 0), 0).toFixed(2)}
                                  </strong>
                                </td>
                                <td></td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.custo_material || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.custo_trilho || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.custo_bando || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.custo_acessorios || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.valor_instalacao || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => {
                                      // Mesmo cálculo detalhado para garantir consistência
                                      const custoTotal = (item.custo_material || 0) + 
                                                        (item.custo_trilho || 0) + 
                                                        (item.custo_bando || 0) + 
                                                        (item.custo_acessorios || 0) +
                                                        (item.valor_instalacao || 0);
                                      return acc + custoTotal;
                                    }, 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency(orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.valor_total || 0), 0))}
                                  </strong>
                                </td>
                                <td>
                                  <strong>
                                    {formatCurrency((() => {
                                      const totalValor = orcamentoDetalhado.itens_detalhados.reduce((acc, item) => acc + (item.valor_total || 0), 0);
                                      const totalCusto = orcamentoDetalhado.itens_detalhados.reduce((acc, item) => {
                                        // Mesmo cálculo detalhado para garantir consistência
                                        const custoTotal = (item.custo_material || 0) + 
                                                          (item.custo_trilho || 0) + 
                                                          (item.custo_bando || 0) + 
                                                          (item.custo_acessorios || 0) +
                                                          (item.valor_instalacao || 0);
                                        return acc + custoTotal;
                                      }, 0);
                                      
                                      return totalValor > 0 ? ((totalValor - totalCusto) / totalValor * 100).toFixed(1) : "0.0";
                                    })())}%
                                  </strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p>Não há itens para mostrar</p>
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
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReportsNew;
