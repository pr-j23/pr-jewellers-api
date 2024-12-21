export const errorHandler = () => async (c, next) => {
    try {
      await next();
    } catch (error) {
      console.error(error);
  
      if (error.name === 'ValidationError') {
        return c.json({ error: error.message }, 400);
      }
  
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  };