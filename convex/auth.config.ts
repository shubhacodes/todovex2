const authConfig = {
  providers: [
    {
      domain: process.env.NEXT_PUBLIC_CONVEX_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
