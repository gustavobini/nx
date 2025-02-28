import 'dotenv/config';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nrwl/devkit';
import exportApp from 'next/dist/export';
import { PHASE_EXPORT } from 'next/dist/next-server/lib/constants';
import { resolve } from 'path';
import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { assertDependentProjectsHaveBeenBuilt } from '../../utils/buildable-libs';

export default async function exportExecutor(
  options: NextExportBuilderOptions,
  context: ExecutorContext
) {
  let dependencies: DependentBuildableProjectNode[] = [];
  if (!options.buildLibsFromSource) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.root,
      context.projectName,
      'build', // this should be generalized
      context.configurationName
    );
    dependencies = result.dependencies;

    assertDependentProjectsHaveBeenBuilt(dependencies, context);
  }

  const buildTarget = parseTargetString(options.buildTarget);
  const build = await runExecutor(buildTarget, {}, context);

  for await (const result of build) {
    if (!result.success) {
      return result;
    }
  }

  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    buildTarget,
    context
  );
  const root = resolve(context.root, buildOptions.root);
  const config = await prepareConfig(
    PHASE_EXPORT,
    buildOptions,
    context,
    dependencies
  );

  await exportApp(
    root,
    {
      statusMessage: 'Exporting',
      silent: options.silent,
      threads: options.threads,
      outdir: `${buildOptions.outputPath}/exported`,
    } as any,
    config
  );

  return { success: true };
}
