"""Sample ETL job for the advanced datalake starter kit.

This is a placeholder script that demonstrates a minimal Glue ETL job.
Replace this with your actual data transformation logic.
"""
import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext

args = getResolvedOptions(sys.argv, ["JOB_NAME"])
sc = SparkContext()
glueContext = GlueContext(sc)
print(f"Running job: {args['JOB_NAME']}")

# Example: read from raw bucket, transform, write to transformed bucket
# source_df = glueContext.create_dynamic_frame.from_catalog(
#     database="sample-database", table_name="sample_data"
# )
# transformed_df = source_df.toDF().withColumn("processed", lit(True))
# glueContext.write_dynamic_frame.from_options(
#     frame=DynamicFrame.fromDF(transformed_df, glueContext, "output"),
#     connection_type="s3",
#     connection_options={"path": "s3://<transformed-bucket>/data/output/"},
#     format="parquet",
# )
