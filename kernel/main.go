// Trae Ultra Kernel - AI对话内核程序
// 通过stdio JSON-RPC与UI进程通信。
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/trae-ultra/kernel/internal/cache"
	"github.com/trae-ultra/kernel/internal/config"
	"github.com/trae-ultra/kernel/internal/server"
	"github.com/trae-ultra/kernel/internal/stats"

	// 导入Provider包以触发init()注册
	_ "github.com/trae-ultra/kernel/internal/provider/deepseek"
	_ "github.com/trae-ultra/kernel/internal/provider/volcengine"
)

const (
	version   = "0.1.0"
	buildTime = "2026-06-26"
)

func main() {
	configPath := flag.String("config", "", "配置文件路径 (默认 ~/.trae-ultra/config.json)")
	showVersion := flag.Bool("version", false, "显示版本信息")
	flag.Parse()

	if *showVersion {
		fmt.Fprintf(os.Stderr, "Trae Ultra Kernel v%s (build: %s)\n", version, buildTime)
		os.Exit(0)
	}

	logger := log.New(os.Stderr, "[kernel] ", log.LstdFlags|log.Lmicroseconds)

	logger.Printf("Trae Ultra Kernel v%s 启动中...", version)
	logger.Printf("配置文件路径: %s", getConfigPath(*configPath))

	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.Fatalf("加载配置失败: %v", err)
	}
	logger.Printf("配置加载成功，默认模型: %s", cfg.DefaultModel)
	logger.Printf("可用Provider: %v", getProviderStatus(cfg))

	cacheMonitor := cache.NewMonitor()
	costCalc := stats.NewCostCalculator()
	logger.Printf("缓存监控和费用计算器初始化完成")

	rpcServer := server.New(cfg, cacheMonitor, costCalc, logger)
	logger.Printf("JSON-RPC服务器初始化完成，等待stdin连接...")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		logger.Printf("收到信号 %v，正在优雅退出...", sig)
		os.Exit(0)
	}()

	if err := rpcServer.Run(os.Stdin, os.Stdout); err != nil {
		logger.Printf("服务器运行错误: %v", err)
		os.Exit(1)
	}

	logger.Printf("服务器正常退出")
}

func getConfigPath(explicit string) string {
	if explicit != "" {
		return explicit
	}
	return config.DefaultConfigPath()
}

func getProviderStatus(cfg *config.Config) []string {
	status := make([]string, 0)
	providers := []string{"deepseek", "volcengine"}
	for _, p := range providers {
		if cfg.GetAPIKey(p) != "" {
			status = append(status, p+":ok")
		} else {
			status = append(status, p+":nokey")
		}
	}
	return status
}
