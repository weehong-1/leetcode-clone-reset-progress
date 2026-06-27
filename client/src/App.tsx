import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { FunctionComponent } from "@/common/types";
import type { TanstackRouter } from "@/main";
import { useApplyFontSize } from "@/lib/font-size";
import { useApplyTheme } from "@/lib/theme";
import { TanStackDevelopmentTools } from "@/components/utils/development-tools/TanStackDevelopmentTools";

const queryClient = new QueryClient();

type AppProps = { router: TanstackRouter };

const App = ({ router }: AppProps): FunctionComponent => {
	useApplyTheme();
	useApplyFontSize();
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<TanStackDevelopmentTools router={router} />
		</QueryClientProvider>
	);
};

export default App;
