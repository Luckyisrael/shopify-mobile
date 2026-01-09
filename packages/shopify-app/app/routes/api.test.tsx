export const loader = async () => {
    return Response.json({
        message: "API Test Route Working",
        timestamp: new Date().toISOString()
    });
};
