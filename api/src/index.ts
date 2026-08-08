import express, { NextFunction, Request, Response } from 'express';


const delayMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const delay = Math.random() * 300 + 300;

    setTimeout(() => {
        next();
    }, delay);
};

const forceStatusMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const forceStatus = req.headers['x-force-status'];

    if (forceStatus) {
        const statusCode = Number(forceStatus);
        
        if (statusCode === 401 || statusCode === 500) {
            return res.status(statusCode).json({
                error: `Forced error triggered by x-force-status header`
            });
        }
    };

    next();
};

const PORT = 4000;
const app = express();

app.use(express.json());
app.use(delayMiddleware);
app.use(forceStatusMiddleware);

const shipments: Shipment[] = Array.from({ length: 10 }, (_, index) => {
    const id = index + 1;

    return {
        id,
        orderId: id * 2,
        trakingNumber: getTrackingNumber(),
        carrier: index % 2 === 0 ? "DHL" : "FedEx",
        estimatedDelivery: `2026-08-${10 + id}`
    };
});

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: "ok"
    });
});

const defaultOrders = generateOrders(30);

app.get('/orders', (req: Request, res: Response) => {
    const status = req.query.status;
    const rawPage = req.query.page ?? "1";
    const rawSize = req.query.size ?? "10";
    const seed = req.query.seed;

    const page = Number(rawPage);
    const size = Number(rawSize);

    let sourceOrders = defaultOrders;
    if (seed) {
        const count = Number(seed);
        if (!isNaN(count) && count > 0) {
            sourceOrders = generateOrders(count);
        }
    }

    let filteredOrders = sourceOrders;
    if (status) {
        const statusStr = String(status).toLocaleLowerCase();

        filteredOrders = sourceOrders.filter(r => r.status.toLocaleLowerCase() === statusStr)

    }

    const total = filteredOrders.length;

    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;

    const paginatedItems = filteredOrders.slice(startIndex, endIndex);

    return res.status(200).json({
        items: paginatedItems,
        total,
        page,
        size
    });
});

app.get('/shipments', (req: Request, res: Response) => {
    res.status(200).json(shipments);
})

app.post('/shipments', (req: Request, res: Response) => {
    const { orderId, carrier } = req.body;
    
    if (!orderId || !carrier) {
        return res.status(400).json({ error: "orderId and carrier are required fields" })
    }

    const newShipment: Shipment = {
        id: shipments.length + 1,
        orderId: Number(orderId),
        trakingNumber: getTrackingNumber(),
        carrier,
        estimatedDelivery: `2026-08-25`
    }

    shipments.push(newShipment);
    
    res.status(201).json(newShipment);
})

app.listen(PORT, () => {
    console.log(`[API] backend is running on htpp://localhost:${PORT}`);
});

function getTrackingNumber(): string {
    return `TRK-${Math.floor(Math.random() * 900000) + 100000}`;
}

function generateOrders(count: number) {
    const ORDER_STATUSES = ["pending", "processing", "shipped", "cancelled"] as const;

    const orders = Array.from({ length: count }, (_, index) => {
        const id = index + 1;
        const name = `Customer ${id}`;
        const status = ORDER_STATUSES[index % ORDER_STATUSES.length];
        const total = Number((Math.random() * 490 + 10).toFixed(2));

        return {
            id,
            name,
            status,
            total
        };
    });

    return orders;
}

interface Shipment {
    id: number;
    orderId: number;
    trakingNumber: string;
    carrier: string;
    estimatedDelivery: string;
}
