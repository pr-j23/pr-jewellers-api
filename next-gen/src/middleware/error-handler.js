export const errorHandler = () => async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('[next-gen] unhandled error', error);

    if (error?.status && error?.message) {
      return c.json({ status: 'error', message: error.message }, error.status);
    }

    return c.json({ status: 'error', message: 'Internal Server Error' }, 500);
  }
};
