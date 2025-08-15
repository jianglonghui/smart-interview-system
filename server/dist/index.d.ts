declare class Server {
    private app;
    private httpServer;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    private ensureDirectories;
    start(): void;
    private shutdown;
}
export default Server;
//# sourceMappingURL=index.d.ts.map