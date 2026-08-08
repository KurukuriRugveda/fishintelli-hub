import React from 'react';
import ReactECharts from 'echarts-for-react';

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

export default function AnalyticsDashboard({ analyticsData, isDarkMode }) {
  if (!analyticsData || !analyticsData.kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const textStyle = {
    fontFamily: 'Inter, sans-serif',
    color: isDarkMode ? '#fafafa' : '#09090b'
  };

  const lineStyle = {
    color: isDarkMode ? '#1e1e24' : '#e4e4e7'
  };

  // 1. Document Category Chart (Pie)
  const categoryChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Documents by Operational Stage',
      left: 'center',
      textStyle: {
        ...textStyle,
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: isDarkMode ? '#0c0c0f' : '#ffffff',
      borderColor: isDarkMode ? '#1e1e24' : '#e4e4e7',
      textStyle: {
        color: isDarkMode ? '#fafafa' : '#09090b'
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: 'bottom',
      textStyle
    },
    series: [
      {
        name: 'Document Type',
        type: 'pie',
        radius: '55%',
        center: ['50%', '50%'],
        data: Object.entries(analyticsData.typeCounts || {}).map(([name, value]) => ({ name, value })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        color: COLORS
      }
    ]
  };

  // 2. Water Quality Monitor Chart (Line - pH, DO, Water Temp)
  const wqData = analyticsData.wqTrend || [];
  const wqChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Water Quality Telemetry (pH, Oxygen & Temp)',
      left: 'center',
      textStyle: {
        ...textStyle,
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? '#0c0c0f' : '#ffffff',
      borderColor: isDarkMode ? '#1e1e24' : '#e4e4e7',
      textStyle: {
        color: isDarkMode ? '#fafafa' : '#09090b'
      }
    },
    legend: {
      data: ['pH', 'Dissolved Oxygen (mg/L)', 'Temp (°C)'],
      bottom: '10px',
      textStyle
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: wqData.map(d => new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      axisLine: { lineStyle },
      axisLabel: { textStyle }
    },
    yAxis: [
      {
        type: 'value',
        name: 'pH / DO',
        min: 0,
        max: 14,
        axisLine: { lineStyle },
        axisLabel: { textStyle },
        splitLine: { lineStyle }
      },
      {
        type: 'value',
        name: 'Temp (°C)',
        min: 0,
        max: 35,
        axisLine: { lineStyle },
        axisLabel: { textStyle },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'pH',
        type: 'line',
        data: wqData.map(d => d.pH),
        lineStyle: { width: 3 },
        color: '#3b82f6', // Blue
        smooth: true
      },
      {
        name: 'Dissolved Oxygen (mg/L)',
        type: 'line',
        data: wqData.map(d => d.do),
        lineStyle: { width: 3 },
        color: '#10b981', // Green
        smooth: true
      },
      {
        name: 'Temp (°C)',
        type: 'line',
        yAxisIndex: 1,
        data: wqData.map(d => d.temp),
        lineStyle: { width: 2, type: 'dashed' },
        color: '#f59e0b', // Amber
        smooth: true
      }
    ]
  };

  // 3. Cold Storage Temperature Chart (Line)
  const coldData = analyticsData.coldTrend || [];
  const coldChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Cold Chain Compliance & Freezer Logs',
      left: 'center',
      textStyle: {
        ...textStyle,
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? '#0c0c0f' : '#ffffff',
      borderColor: isDarkMode ? '#1e1e24' : '#e4e4e7',
      textStyle: {
        color: isDarkMode ? '#fafafa' : '#09090b'
      }
    },
    legend: {
      data: ['Avg Temp (°C)', 'Max Temp (°C)', 'Threshold (-18°C)'],
      bottom: '10px',
      textStyle
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: coldData.map((d, i) => `Log ${i + 1}`),
      axisLine: { lineStyle },
      axisLabel: { textStyle }
    },
    yAxis: {
      type: 'value',
      name: 'Temperature (°C)',
      max: 0,
      min: -30,
      axisLine: { lineStyle },
      axisLabel: { textStyle },
      splitLine: { lineStyle }
    },
    series: [
      {
        name: 'Avg Temp (°C)',
        type: 'line',
        data: coldData.map(d => d.avgTemp),
        color: '#06b6d4',
        smooth: true,
        lineStyle: { width: 3 }
      },
      {
        name: 'Max Temp (°C)',
        type: 'line',
        data: coldData.map(d => d.maxTemp),
        color: '#ef4444',
        smooth: true,
        lineStyle: { width: 3 }
      },
      {
        name: 'Threshold (-18°C)',
        type: 'line',
        data: Array(coldData.length).fill(-18.0),
        color: '#ec4899',
        lineStyle: { width: 2, type: 'dashed' },
        symbol: 'none'
      }
    ]
  };

  return (
    <div className="space-y-8">
      {/* Chart 1: Category Distribution */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <ReactECharts option={categoryChartOption} style={{ height: '350px' }} />
      </div>

      {/* Chart 2: Water Quality Trends */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <ReactECharts option={wqChartOption} style={{ height: '350px' }} />
      </div>

      {/* Chart 3: Cold Chain Logger */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <ReactECharts option={coldChartOption} style={{ height: '350px' }} />
      </div>
    </div>
  );
}
